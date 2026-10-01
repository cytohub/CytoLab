import { eq } from 'drizzle-orm';
import { addDays, todayIn } from '../../src/domain/dates';
import type { ExperimentStatus } from '../../src/domain/enums';
import { formatExperimentId, formatMilestoneId, formatSampleId } from '../../src/domain/identifiers';
import { closeDb, db, type Transaction } from '../../src/server/db/client';
import * as s from '../../src/server/db/schema';
import { hashPassword } from '../../src/server/auth/password';
import { reindexOrganization } from '../../src/server/modules/search/indexers';
import { bumpSequenceTo } from '../../src/server/platform/sequences';
import { uuidv7 } from '../../src/server/db/uuid';
import {
  DEMO_PASSWORD,
  EXPERIMENT_TYPES,
  ORG,
  PEOPLE,
  PROJECTS,
  RESEARCH_AREAS,
  TAGS,
  TEAMS,
  type Blueprint,
  type ProjectSeed,
} from './catalog';
import { createRandom } from './random';

const DAY_MS = 86_400_000;
const SEEDED_AT = Date.now();
const START_OF_TODAY = Math.floor(SEEDED_AT / DAY_MS) * DAY_MS;
const rng = createRandom(20240517);

/**
 * A timestamp `dayOffset` days from today at a given hour (deterministic, for demo
 * history). Seeded timestamps record things that already happened, so they never
 * land after the moment the seed runs: "today at 4 pm" collapses to a few minutes
 * ago when the seed runs in the morning.
 */
function instant(dayOffset: number, hour = 10, minute = 0): Date {
  const at = START_OF_TODAY + dayOffset * DAY_MS + hour * 3_600_000 + minute * 60_000;
  return new Date(Math.min(at, SEEDED_AT - 5 * 60_000));
}
function offsetToDate(dayOffset: number): string {
  return addDays(todayIn(ORG.timezone), dayOffset);
}
function metricValue(range: [number, number], digits = 1): number {
  return rng.float(range[0], range[1], digits);
}

interface SeededUser {
  id: string;
  key: string;
  role: (typeof PEOPLE)[number]['role'];
}

export async function seedDemoData(options: { force?: boolean } = {}): Promise<string> {
  const database = db();
  try {
    const existing = await database.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, ORG.slug)).limit(1);
    if (existing.length > 0 && !options.force) {
      return `organization "${ORG.slug}" already present — run "pnpm db:reset" to rebuild it`;
    }
    if (existing.length > 0 && options.force) {
      throw new Error('the demo organization already exists; use "pnpm db:reset" (the audit log cannot be truncated in place)');
    }

    const counts = await database.transaction(async (tx) => buildWorkspace(tx));
    return `${counts.projects} projects, ${counts.experiments} experiments, ${counts.users} users, ${counts.activity} activity events`;
  } finally {
    await closeDb();
  }
}

async function buildWorkspace(tx: Transaction) {
  const orgId = uuidv7();
  await tx.insert(s.organizations).values({ id: orgId, name: ORG.name, slug: ORG.slug, timezone: ORG.timezone, isDemo: true });

  // --- People -------------------------------------------------------------
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const usersByKey = new Map<string, SeededUser>();
  for (const person of PEOPLE) {
    const id = uuidv7();
    await tx.insert(s.users).values({
      id,
      email: person.email,
      name: person.name,
      title: person.title,
      avatarColor: person.color,
      passwordHash,
      lastLoginAt: instant(-rng.int(0, 3), rng.int(8, 18)),
    });
    await tx.insert(s.orgMemberships).values({ orgId, userId: id, role: person.role, status: 'active' });
    usersByKey.set(person.key, { id, key: person.key, role: person.role });
  }
  const uid = (key: string) => usersByKey.get(key)!.id;
  const admin = uid('sarah');

  // --- Teams --------------------------------------------------------------
  const teamIdByKey = new Map<string, string>();
  for (const team of TEAMS) {
    const id = uuidv7();
    await tx.insert(s.teams).values({ id, orgId, name: team.name, description: team.description, color: team.color, createdBy: admin });
    teamIdByKey.set(team.key, id);
  }
  for (const person of PEOPLE) {
    for (const membership of person.teams) {
      await tx.insert(s.teamMemberships).values({
        teamId: teamIdByKey.get(membership.team)!,
        userId: uid(person.key),
        orgId,
        role: membership.lead ? 'lead' : 'member',
      });
    }
  }
  const teamMembers = (teamKey: string) => PEOPLE.filter((p) => p.teams.some((t) => t.team === teamKey)).map((p) => p.key);

  // --- Configuration ------------------------------------------------------
  const areaIdByName = new Map<string, string>();
  for (const area of RESEARCH_AREAS) {
    const id = uuidv7();
    await tx.insert(s.researchAreas).values({ id, orgId, name: area.name, color: area.color });
    areaIdByName.set(area.name, id);
  }
  const typeIdByName = new Map<string, string>();
  for (const type of EXPERIMENT_TYPES) {
    const id = uuidv7();
    await tx.insert(s.experimentTypes).values({ id, orgId, name: type.name, category: type.category, color: type.color, description: type.description });
    typeIdByName.set(type.name, id);
  }
  const tagIdByName = new Map<string, string>();
  for (const tag of TAGS) {
    const id = uuidv7();
    await tx.insert(s.tags).values({ id, orgId, name: tag.name, color: tag.color, createdBy: admin });
    tagIdByName.set(tag.name, id);
  }

  const activity: Array<typeof s.activityEvents.$inferInsert> = [];
  const audits: Array<typeof s.auditLog.$inferInsert> = [];
  const notifications: Array<typeof s.notifications.$inferInsert> = [];
  let experimentSeq = 0;
  let sampleSeq = 0;
  let experimentTotal = 0;

  const logActivity = (e: Omit<typeof s.activityEvents.$inferInsert, 'orgId'>) => activity.push({ ...e, orgId });
  const logAudit = (e: Omit<typeof s.auditLog.$inferInsert, 'orgId'>) => audits.push({ ...e, orgId });

  // --- Projects, milestones, experiments ---------------------------------
  for (const project of PROJECTS) {
    const projectId = uuidv7();
    const createdAt = instant(project.startOffset, 9);
    const ownerId = uid(project.owner);
    const teamId = teamIdByKey.get(project.team)!;
    const completedAt = project.completedOffset != null ? instant(project.completedOffset, 16) : null;

    await tx.insert(s.entities).values({
      id: projectId,
      orgId,
      entityType: 'project',
      displayId: project.code,
      title: project.name,
      createdBy: ownerId,
      createdAt,
    });
    await tx.insert(s.projects).values({
      id: projectId,
      orgId,
      code: project.code,
      name: project.name,
      description: project.description,
      researchAreaId: areaIdByName.get(project.area) ?? null,
      ownerId,
      teamId,
      status: project.status,
      priority: project.priority,
      startDate: offsetToDate(project.startOffset),
      targetDate: offsetToDate(project.targetOffset),
      completedAt,
      notes: project.notes ?? null,
      createdAt,
      updatedAt: completedAt ?? createdAt,
      createdBy: ownerId,
      updatedBy: ownerId,
    });
    logActivity({ occurredAt: createdAt, actorId: ownerId, action: 'project.created', entityId: projectId, projectId, payload: { code: project.code, name: project.name } });
    logAudit({ occurredAt: createdAt, actorId: ownerId, action: 'create', resourceType: 'project', resourceId: projectId, metadata: { code: project.code } });

    // Milestones
    const milestoneRows = project.milestones.map((milestone, index) => {
      const completed = milestone.status === 'completed' && milestone.completedOffset != null;
      const mCompletedAt = completed ? instant(milestone.completedOffset!, 15) : null;
      if (completed) {
        logActivity({
          occurredAt: mCompletedAt!,
          actorId: ownerId,
          action: 'milestone.completed',
          entityId: projectId,
          projectId,
          payload: { milestone: formatMilestoneId(index + 1), title: milestone.title },
        });
      }
      return {
        orgId,
        projectId,
        sequence: index + 1,
        title: milestone.title,
        description: milestone.description ?? null,
        dueDate: offsetToDate(milestone.dueOffset),
        status: milestone.status,
        completedAt: mCompletedAt,
        ownerId,
        position: index,
        createdAt,
        updatedAt: mCompletedAt ?? createdAt,
        createdBy: ownerId,
        updatedBy: ownerId,
      };
    });
    await tx.insert(s.milestones).values(milestoneRows);

    // Experiments
    const memberKeys = teamMembers(project.team);
    const counts = generateExperiments(project);
    for (const gen of counts) {
      experimentSeq += 1;
      experimentTotal += 1;
      const blueprint = project.blueprints[gen.blueprintIndex]!;
      const experimentId = uuidv7();
      const displayId = formatExperimentId(1000 + experimentSeq);
      const researcherKey = rng.pick(memberKeys.length ? memberKeys : [project.owner]);
      const researcherId = uid(researcherKey);
      const typeId = typeIdByName.get(blueprint.type)!;
      // Planned work is written up ahead of time, so a run scheduled for next month
      // was still created in the past.
      const eCreatedAt = instant(Math.min(gen.startOffset - rng.int(1, 4), -rng.int(1, 12)), rng.int(8, 12));
      const title = `${blueprint.title}${gen.runLabel}`;

      await tx.insert(s.entities).values({ id: experimentId, orgId, entityType: 'experiment', displayId, title, createdBy: researcherId, createdAt: eCreatedAt });
      await insertExperiment(tx, {
        id: experimentId,
        orgId,
        seq: experimentSeq,
        displayId,
        projectId,
        typeId,
        title,
        blueprint,
        researcherId,
        teamId,
        status: gen.status,
        startOffset: gen.startOffset,
        completedOffset: gen.completedOffset,
        targetOffset: gen.targetOffset,
        blocked: gen.blocked,
        createdAt: eCreatedAt,
      });

      // Tags
      const chosenTags = rng.pickSome(project.tags, 0, 2);
      for (const tagName of chosenTags) {
        const tagId = tagIdByName.get(tagName);
        if (tagId) await tx.insert(s.entityTags).values({ entityId: experimentId, tagId, orgId, createdBy: researcherId }).onConflictDoNothing();
      }

      // Sub-records
      sampleSeq = await insertSubRecords(tx, {
        orgId,
        experimentId,
        projectId,
        blueprint,
        status: gen.status,
        researcherId,
        startOffset: gen.startOffset,
        completedOffset: gen.completedOffset,
        sampleSeq,
      });

      // Activity + audit for the experiment lifecycle
      logActivity({ occurredAt: eCreatedAt, actorId: researcherId, action: 'experiment.created', entityId: experimentId, projectId, payload: { displayId, name: title } });
      logAudit({ occurredAt: eCreatedAt, actorId: researcherId, action: 'create', resourceType: 'experiment', resourceId: experimentId, metadata: { displayId } });
      if (gen.status !== 'planned') {
        const startedAt = instant(gen.startOffset, rng.int(9, 15));
        logActivity({ occurredAt: startedAt, actorId: researcherId, action: 'experiment.status_changed', entityId: experimentId, projectId, payload: { displayId, from: 'planned', to: 'in_progress' } });
      }
      if (gen.status === 'completed' || gen.status === 'failed') {
        const endAt = instant(gen.completedOffset!, rng.int(14, 18));
        logActivity({ occurredAt: endAt, actorId: researcherId, action: 'experiment.status_changed', entityId: experimentId, projectId, payload: { displayId, from: 'in_progress', to: gen.status } });
        logAudit({ occurredAt: endAt, actorId: researcherId, action: 'status_change', resourceType: 'experiment', resourceId: experimentId, changes: { status: { from: 'in_progress', to: gen.status } }, metadata: { displayId } });
        if (rng.chance(0.6)) {
          logActivity({ occurredAt: new Date(endAt.getTime() - 3_600_000), actorId: researcherId, action: 'result.recorded', entityId: experimentId, projectId, payload: { displayId, count: blueprint.metrics.length } });
        }
      }
    }
  }

  // --- Comments on a few recent experiments ------------------------------
  await seedComments(tx, orgId, usersByKey, logActivity);

  // --- Persist events (chronological) ------------------------------------
  activity.sort((a, b) => a.occurredAt!.getTime() - b.occurredAt!.getTime());
  await chunkedInsert(tx, s.activityEvents, activity);
  await chunkedInsert(tx, s.auditLog, audits);

  // --- Notifications (recent, some unread) -------------------------------
  buildNotifications(orgId, usersByKey, teamMembers, notifications);
  await chunkedInsert(tx, s.notifications, notifications);

  // --- Human-ID counters ---------------------------------------------------
  // New experiments and samples continue after the seeded numbers. Without
  // these rows the first one created after a reset reuses EXP-1001 / SMP-00001,
  // fails on the unique display ID, and rolls the counter back every time.
  await bumpSequenceTo(tx, orgId, 'experiment', experimentSeq);
  await bumpSequenceTo(tx, orgId, 'sample', sampleSeq);

  // --- Search index -------------------------------------------------------
  await reindexOrganization(tx, orgId);

  return { projects: PROJECTS.length, experiments: experimentTotal, users: PEOPLE.length, activity: activity.length };
}

// ---------------------------------------------------------------------------
// Experiment planning
// ---------------------------------------------------------------------------

interface GeneratedExperiment {
  blueprintIndex: number;
  runLabel: string;
  status: ExperimentStatus;
  startOffset: number;
  completedOffset: number | null;
  targetOffset: number | null;
  blocked: string | null;
}

const BLOCK_REASONS = [
  'Awaiting reagent lot qualification',
  'Instrument down — service scheduled',
  'Blocked on donor material availability',
  'Waiting on sequencing core turnaround',
  'Pending QA review of protocol deviation',
];

function generateExperiments(project: ProjectSeed): GeneratedExperiment[] {
  const today = 0;
  const results: GeneratedExperiment[] = [];
  const runCounter = new Map<number, number>();

  for (let i = 0; i < project.experimentCount; i++) {
    const blueprintIndex = i % project.blueprints.length;
    const run = (runCounter.get(blueprintIndex) ?? 0) + 1;
    runCounter.set(blueprintIndex, run);
    const runLabel = run > 1 ? ` — run ${run}` : '';

    const startOffset = rng.int(project.window[0], project.window[1]);
    let status: ExperimentStatus;
    let completedOffset: number | null = null;
    let targetOffset: number | null = null;
    let blocked: string | null = null;

    const targetGap = rng.int(7, 28);
    targetOffset = startOffset + targetGap;

    if (project.status === 'completed') {
      status = rng.weighted([['completed', 8], ['failed', 1], ['cancelled', 1]]);
      completedOffset = status === 'cancelled' ? null : Math.min(today, startOffset + rng.int(3, targetGap));
    } else if (startOffset > today) {
      status = 'planned';
    } else {
      // Status follows the calendar: runs that started long ago have mostly
      // finished, and open work is concentrated in the last few weeks. Only a
      // minority of open runs is overdue or blocked, so "needs attention" has
      // something to show without the whole portfolio looking late.
      const age = today - startOffset;
      const choices: Array<readonly [ExperimentStatus, number]> =
        age > 35
          ? [['completed', 12], ['failed', 3], ['cancelled', 1], ['in_progress', 1]]
          : [['completed', 4], ['in_progress', 7], ['failed', 1], ['cancelled', 1]];
      // A run whose planned start slipped by a few days reads as "not started".
      if (age <= 10) choices.push(['planned', 1]);
      status = rng.weighted(choices);
      if (status === 'completed' || status === 'failed') {
        completedOffset = Math.min(today, startOffset + rng.int(2, targetGap + 5));
      } else if (status === 'in_progress') {
        // Longer assays run past their first target; most open runs are on schedule.
        // An overdue target still falls after the run's own start date.
        targetOffset = age >= 3 && rng.chance(0.3) ? rng.int(Math.max(startOffset + 1, -14), -1) : rng.int(2, 28);
        if (rng.chance(0.15)) blocked = rng.pick(BLOCK_REASONS);
      }
    }

    results.push({ blueprintIndex, runLabel, status, startOffset, completedOffset, targetOffset, blocked });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

interface ExperimentInsert {
  id: string;
  orgId: string;
  seq: number;
  displayId: string;
  projectId: string;
  typeId: string;
  title: string;
  blueprint: Blueprint;
  researcherId: string;
  teamId: string;
  status: ExperimentStatus;
  startOffset: number;
  completedOffset: number | null;
  targetOffset: number | null;
  blocked: string | null;
  createdAt: Date;
}

async function insertExperiment(tx: Transaction, e: ExperimentInsert): Promise<void> {
  const isDone = e.status === 'completed' || e.status === 'failed';
  const started = e.status !== 'planned';
  const statusChangedAt = isDone && e.completedOffset != null ? instant(e.completedOffset, 16) : started ? instant(e.startOffset, 11) : e.createdAt;
  // Most open runs saw activity this week; a few have genuinely gone quiet ("stale").
  const inProgressActivityOffset = Math.max(e.startOffset, rng.chance(0.15) ? -rng.int(15, 30) : -rng.int(0, 8));
  const lastActivityAt = isDone && e.completedOffset != null ? instant(e.completedOffset, 17) : e.status === 'in_progress' ? instant(inProgressActivityOffset, 14) : statusChangedAt;

  const conclusion = isDone ? e.blueprint.conclusion : null;
  const summary = e.status === 'completed' ? e.blueprint.summary : e.status === 'failed' ? 'Run did not meet acceptance criteria; see observations (synthetic demo data).' : null;

  await tx.insert(s.experiments).values({
    id: e.id,
    orgId: e.orgId,
    number: 1000 + e.seq,
    displayId: e.displayId,
    projectId: e.projectId,
    experimentTypeId: e.typeId,
    name: e.title,
    objective: e.blueprint.objective,
    hypothesis: e.blueprint.hypothesis,
    researcherId: e.researcherId,
    teamId: e.teamId,
    status: e.status,
    priority: rng.weighted([['low', 1], ['medium', 5], ['high', 3], ['critical', 1]]),
    startDate: started ? offsetToDate(e.startOffset) : e.startOffset > 0 ? offsetToDate(e.startOffset) : null,
    targetDate: e.targetOffset != null ? offsetToDate(e.targetOffset) : null,
    completedDate: e.completedOffset != null ? offsetToDate(e.completedOffset) : null,
    protocolRef: e.blueprint.protocolRef ?? null,
    blockedReason: e.blocked,
    resultsSummary: summary,
    conclusion,
    statusChangedAt,
    lastActivityAt,
    createdAt: e.createdAt,
    updatedAt: lastActivityAt,
    createdBy: e.researcherId,
    updatedBy: e.researcherId,
  });
}

interface SubRecordArgs {
  orgId: string;
  experimentId: string;
  projectId: string;
  blueprint: Blueprint;
  status: ExperimentStatus;
  researcherId: string;
  startOffset: number;
  completedOffset: number | null;
  sampleSeq: number;
}

async function insertSubRecords(tx: Transaction, a: SubRecordArgs): Promise<number> {
  const { blueprint } = a;
  const producedResults = a.status === 'completed' || a.status === 'failed' || (a.status === 'in_progress' && rng.chance(0.5));

  await tx.insert(s.experimentConditions).values(
    blueprint.conditions.map((c, index) => ({
      orgId: a.orgId,
      experimentId: a.experimentId,
      name: c[0],
      value: c[1],
      unit: c[2] ?? null,
      position: index,
      createdBy: a.researcherId,
    })),
  );

  await tx.insert(s.experimentInputs).values(
    blueprint.inputs.map((input, index) => ({
      orgId: a.orgId,
      experimentId: a.experimentId,
      name: input.name,
      inputType: input.type,
      identifier: input.identifier ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      position: index,
      createdBy: a.researcherId,
    })),
  );

  const stepCompleteThrough = a.status === 'completed' || a.status === 'failed' ? blueprint.steps.length : a.status === 'in_progress' ? rng.int(1, blueprint.steps.length) : 0;
  await tx.insert(s.experimentProtocolSteps).values(
    blueprint.steps.map((title, index) => ({
      orgId: a.orgId,
      experimentId: a.experimentId,
      position: index,
      title,
      completedAt: index < stepCompleteThrough ? instant(a.startOffset + index, 12) : null,
      completedBy: index < stepCompleteThrough ? a.researcherId : null,
      createdBy: a.researcherId,
    })),
  );

  // Observations
  const observationDay = a.completedOffset ?? Math.min(0, a.startOffset + 2);
  const observations: Array<typeof s.experimentObservations.$inferInsert> = [];
  if (a.status !== 'planned') {
    observations.push({
      orgId: a.orgId,
      experimentId: a.experimentId,
      authorId: a.researcherId,
      observedAt: instant(a.startOffset + 1, 13),
      body: 'Setup completed; reagents and controls prepared per protocol. All materials within expiry (synthetic demo data).',
      significance: 'routine',
    });
    if (a.status === 'failed') {
      observations.push({
        orgId: a.orgId,
        experimentId: a.experimentId,
        authorId: a.researcherId,
        observedAt: instant(observationDay, 15),
        body: 'Positive control signal below threshold; run flagged for repeat. Suspected reagent degradation (synthetic demo data).',
        significance: 'critical',
      });
    } else if (producedResults && rng.chance(0.5)) {
      observations.push({
        orgId: a.orgId,
        experimentId: a.experimentId,
        authorId: a.researcherId,
        observedAt: instant(observationDay, 14),
        body: 'Readouts consistent with expectations; controls behaved as anticipated (synthetic demo data).',
        significance: 'notable',
      });
    }
  }
  if (observations.length) await tx.insert(s.experimentObservations).values(observations);

  // Samples (from blueprint output)
  let sampleSeq = a.sampleSeq;
  const sampleIdByLabel = new Map<string, string>();
  if (blueprint.output && a.status !== 'planned' && a.status !== 'cancelled') {
    sampleSeq += 1;
    const sampleId = uuidv7();
    const displayId = formatSampleId(sampleSeq);
    const label = blueprint.output.name;
    await tx.insert(s.entities).values({ id: sampleId, orgId: a.orgId, entityType: 'sample', displayId, title: label, createdBy: a.researcherId, createdAt: instant(observationDay, 12) });
    await tx.insert(s.samples).values({
      id: sampleId,
      orgId: a.orgId,
      number: sampleSeq,
      displayId,
      name: label,
      sampleType: blueprint.output.type,
      status: rng.weighted([['available', 5], ['in_use', 3], ['depleted', 2]]),
      projectId: a.projectId,
      quantity: rng.int(5, 80),
      unit: blueprint.output.unit ?? null,
      storageLocation: `Freezer ${rng.pick(['A', 'B', 'C'])}-${rng.int(1, 8)} · Shelf ${rng.int(1, 5)} · Box ${rng.int(1, 20)}`,
      createdBy: a.researcherId,
      updatedBy: a.researcherId,
      createdAt: instant(observationDay, 12),
      updatedAt: instant(observationDay, 12),
    });
    await tx.insert(s.experimentSamples).values({ experimentId: a.experimentId, sampleId, orgId: a.orgId, role: 'output', createdBy: a.researcherId });
    sampleIdByLabel.set(label, sampleId);
  }

  // Results
  if (producedResults) {
    await tx.insert(s.experimentResults).values(
      blueprint.metrics.map((metric) => ({
        orgId: a.orgId,
        experimentId: a.experimentId,
        name: metric.name,
        valueNumeric: metric.range ? metricValue(metric.range, metric.digits ?? 1) : null,
        valueText: metric.range ? null : 'see notes',
        unit: metric.unit ?? null,
        isKey: metric.key ?? false,
        recordedAt: instant(observationDay, 16),
        recordedBy: a.researcherId,
      })),
    );
  }

  return sampleSeq;
}

// ---------------------------------------------------------------------------
// Comments & notifications
// ---------------------------------------------------------------------------

async function seedComments(
  tx: Transaction,
  orgId: string,
  usersByKey: Map<string, SeededUser>,
  logActivity: (e: Omit<typeof s.activityEvents.$inferInsert, 'orgId'>) => void,
): Promise<void> {
  const recent = await tx
    .select({ id: s.experiments.id, projectId: s.experiments.projectId, displayId: s.experiments.displayId, researcherId: s.experiments.researcherId })
    .from(s.experiments)
    .where(eq(s.experiments.orgId, orgId))
    .orderBy(s.experiments.lastActivityAt)
    .limit(60);

  const commenters = [...usersByKey.values()];
  const bodies = [
    'Nice result — can you add the gating strategy to the Files tab?',
    'Let’s replicate this with the new reagent lot before we close it out.',
    'Flagging for the M3 review; this looks on track.',
    'Did the controls behave as expected on this run?',
    'Can we compare these numbers against last month’s run?',
    'Please attach the raw acquisition files when you get a chance.',
  ];
  const chosen = rng.pickSome(recent, 10, 14);
  for (const experiment of chosen) {
    const author = rng.pick(commenters);
    const at = instant(-rng.int(0, 12), rng.int(9, 17), rng.int(0, 59));
    await tx.insert(s.comments).values({ orgId, entityId: experiment.id, authorId: author.id, body: rng.pick(bodies), createdAt: at, updatedAt: at });
    logActivity({ occurredAt: at, actorId: author.id, action: 'comment.created', entityId: experiment.id, projectId: experiment.projectId, payload: { displayId: experiment.displayId } });
  }
}

function buildNotifications(
  orgId: string,
  usersByKey: Map<string, SeededUser>,
  teamMembers: (teamKey: string) => string[],
  out: Array<typeof s.notifications.$inferInsert>,
): void {
  const sarah = usersByKey.get('sarah')!.id;
  const priya = usersByKey.get('priya')!.id;
  const recipients = ['sarah', 'priya', 'marcus', 'elena', 'kenji'];
  const templates: Array<{ type: (typeof s.notifications.$inferInsert)['type']; title: string; body: string }> = [
    { type: 'attention', title: '3 experiments need attention', body: 'Overdue or blocked experiments in your projects.' },
    { type: 'milestone', title: 'Milestone due this week', body: 'A milestone in one of your projects is approaching its due date.' },
    { type: 'assignment', title: 'You were assigned an experiment', body: 'A new experiment was assigned to you.' },
    { type: 'comment', title: 'New comment on an experiment', body: 'Someone commented on an experiment you follow.' },
    { type: 'status_change', title: 'Experiment marked completed', body: 'An experiment in your project changed status.' },
  ];

  recipients.forEach((key, index) => {
    const recipientId = usersByKey.get(key)!.id;
    for (let i = 0; i < 3; i++) {
      const template = templates[(index + i) % templates.length]!;
      const daysAgo = i + index * 0.3;
      out.push({
        orgId,
        recipientId,
        type: template.type,
        actorId: i % 2 === 0 ? sarah : priya,
        title: template.title,
        body: template.body,
        readAt: i === 0 ? null : instant(-Math.floor(daysAgo), 12),
        createdAt: instant(-daysAgo - 0.2, rng.int(8, 18), rng.int(0, 59)),
      });
    }
  });
  void teamMembers;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function chunkedInsert<T extends Record<string, unknown>>(
  tx: Transaction,
  table: Parameters<Transaction['insert']>[0],
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length) await tx.insert(table).values(chunk as never);
  }
}
