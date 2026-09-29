import 'server-only';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { evaluateAttention, type AttentionReason } from '@/domain/attention';
import { dateOf, todayIn } from '@/domain/dates';
import type { ExperimentStatus, Priority } from '@/domain/enums';
import { NotFoundError } from '@/domain/errors';
import {
  EXPERIMENT_STATUS_META,
  INPUT_TYPE_LABELS,
  OBSERVATION_SIGNIFICANCE_META,
  PRIORITY_META,
  SAMPLE_STATUS_META,
} from '@/domain/labels';
import { canEditExperiment } from '@/domain/permissions';
import { EXPERIMENT_TRANSITIONS } from '@/domain/workflows';
import { routes } from '@/lib/routes';
import { actorOf, type AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import {
  entityTags,
  experimentConditions,
  experimentInputs,
  experimentObservations,
  experimentProtocolSteps,
  experimentResults,
  experiments,
  experimentSamples,
  experimentTypes,
  projects,
  samples,
  tags,
  teams,
  users,
} from '../../db/schema';
import { toUserSummary, type TagSummary, type TeamSummary, type UserSummary } from '../shared/presenters';

export interface ConditionView {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  notes: string | null;
  position: number;
}
export interface InputView {
  id: string;
  name: string;
  inputType: { value: string; label: string };
  identifier: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  position: number;
}
export interface StepView {
  id: string;
  position: number;
  title: string;
  details: string | null;
  durationMinutes: number | null;
  completed: boolean;
  completedAt: string | null;
  completedBy: UserSummary | null;
}
export interface ObservationView {
  id: string;
  body: string;
  significance: { value: string; label: string; tone: string };
  observedAt: string;
  author: UserSummary | null;
}
export interface ResultView {
  id: string;
  name: string;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  isKey: boolean;
  notes: string | null;
  sample: { id: string; displayId: string; name: string } | null;
  recordedAt: string;
  recordedBy: UserSummary | null;
}
export interface LinkedSampleView {
  id: string;
  displayId: string;
  name: string;
  sampleType: string;
  status: { value: string; label: string; tone: string };
  role: string;
  quantity: number | null;
  unit: string | null;
  storageLocation: string | null;
  href: string;
}

export interface ExperimentDetail {
  id: string;
  displayId: string;
  name: string;
  objective: string | null;
  hypothesis: string | null;
  status: { value: ExperimentStatus; label: string; tone: string };
  priority: { value: Priority; label: string; tone: string; rank: number };
  project: { id: string; code: string; name: string; href: string };
  experimentType: { id: string; name: string; category: string; color: string };
  researcher: UserSummary | null;
  team: TeamSummary | null;
  startDate: string | null;
  targetDate: string | null;
  completedDate: string | null;
  protocolRef: string | null;
  blockedReason: string | null;
  resultsSummary: string | null;
  conclusion: string | null;
  notes: string | null;
  tags: TagSummary[];
  attention: { needsAttention: boolean; reasons: AttentionReason[] };
  conditions: ConditionView[];
  inputs: InputView[];
  steps: StepView[];
  observations: ObservationView[];
  results: ResultView[];
  samples: LinkedSampleView[];
  counts: { conditions: number; inputs: number; steps: number; stepsCompleted: number; observations: number; results: number; samples: number };
  version: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  createdBy: UserSummary | null;
  permissions: { canEdit: boolean; allowedTransitions: ExperimentStatus[] };
}

function user(row: { id: string | null; name: string | null; title: string | null; email: string | null; color: string | null; avatar: string | null }): UserSummary | null {
  return toUserSummary(row.id ? { id: row.id, name: row.name!, title: row.title, email: row.email!, avatarColor: row.color!, avatarUrl: row.avatar } : null);
}

export async function getExperimentDetail(ctx: AuthContext, experimentId: string): Promise<ExperimentDetail> {
  const [row] = await db()
    .select({
      id: experiments.id,
      displayId: experiments.displayId,
      name: experiments.name,
      objective: experiments.objective,
      hypothesis: experiments.hypothesis,
      status: experiments.status,
      priority: experiments.priority,
      startDate: experiments.startDate,
      targetDate: experiments.targetDate,
      completedDate: experiments.completedDate,
      protocolRef: experiments.protocolRef,
      blockedReason: experiments.blockedReason,
      resultsSummary: experiments.resultsSummary,
      conclusion: experiments.conclusion,
      notes: experiments.notes,
      version: experiments.version,
      statusChangedAt: experiments.statusChangedAt,
      lastActivityAt: experiments.lastActivityAt,
      createdAt: experiments.createdAt,
      updatedAt: experiments.updatedAt,
      createdById: experiments.createdBy,
      researcherId: experiments.researcherId,
      teamId: experiments.teamId,
      projectId: projects.id,
      projectCode: projects.code,
      projectName: projects.name,
      typeId: experimentTypes.id,
      typeName: experimentTypes.name,
      typeCategory: experimentTypes.category,
      typeColor: experimentTypes.color,
      researcherName: users.name,
      researcherTitle: users.title,
      researcherEmail: users.email,
      researcherColor: users.avatarColor,
      researcherAvatar: users.avatarUrl,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(experiments)
    .innerJoin(projects, eq(projects.id, experiments.projectId))
    .innerJoin(experimentTypes, eq(experimentTypes.id, experiments.experimentTypeId))
    .leftJoin(users, eq(users.id, experiments.researcherId))
    .leftJoin(teams, eq(teams.id, experiments.teamId))
    .where(and(eq(experiments.orgId, ctx.orgId), eq(experiments.id, experimentId), isNull(experiments.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('Experiment');

  const [creatorRow] = row.createdById
    ? await db().select({ id: users.id, name: users.name, title: users.title, email: users.email, color: users.avatarColor, avatar: users.avatarUrl }).from(users).where(eq(users.id, row.createdById)).limit(1)
    : [null];

  const [conditionRows, inputRows, stepRows, observationRows, resultRows, sampleRows, tagRows] = await Promise.all([
    db().select().from(experimentConditions).where(eq(experimentConditions.experimentId, experimentId)).orderBy(asc(experimentConditions.position)),
    db().select().from(experimentInputs).where(eq(experimentInputs.experimentId, experimentId)).orderBy(asc(experimentInputs.position)),
    db()
      .select({ step: experimentProtocolSteps, cbName: users.name, cbTitle: users.title, cbEmail: users.email, cbColor: users.avatarColor, cbAvatar: users.avatarUrl, cbId: users.id })
      .from(experimentProtocolSteps)
      .leftJoin(users, eq(users.id, experimentProtocolSteps.completedBy))
      .where(eq(experimentProtocolSteps.experimentId, experimentId))
      .orderBy(asc(experimentProtocolSteps.position)),
    db()
      .select({ obs: experimentObservations, aName: users.name, aTitle: users.title, aEmail: users.email, aColor: users.avatarColor, aAvatar: users.avatarUrl, aId: users.id })
      .from(experimentObservations)
      .leftJoin(users, eq(users.id, experimentObservations.authorId))
      .where(and(eq(experimentObservations.experimentId, experimentId), isNull(experimentObservations.deletedAt)))
      .orderBy(desc(experimentObservations.observedAt)),
    db()
      .select({ res: experimentResults, sId: samples.id, sDisplay: samples.displayId, sName: samples.name, rbName: users.name, rbTitle: users.title, rbEmail: users.email, rbColor: users.avatarColor, rbAvatar: users.avatarUrl, rbId: users.id })
      .from(experimentResults)
      .leftJoin(samples, eq(samples.id, experimentResults.sampleId))
      .leftJoin(users, eq(users.id, experimentResults.recordedBy))
      .where(and(eq(experimentResults.experimentId, experimentId), isNull(experimentResults.deletedAt)))
      .orderBy(desc(experimentResults.isKey), asc(experimentResults.recordedAt)),
    db()
      .select({ link: experimentSamples, s: samples })
      .from(experimentSamples)
      .innerJoin(samples, eq(samples.id, experimentSamples.sampleId))
      .where(and(eq(experimentSamples.experimentId, experimentId), isNull(samples.deletedAt))),
    db().select({ id: tags.id, name: tags.name, color: tags.color }).from(entityTags).innerJoin(tags, eq(tags.id, entityTags.tagId)).where(eq(entityTags.entityId, experimentId)).orderBy(asc(tags.name)),
  ]);

  const today = todayIn(ctx.org.timezone);
  const attentionReasons = evaluateAttention(
    {
      status: row.status,
      startDate: row.startDate,
      targetDate: row.targetDate,
      blockedReason: row.blockedReason,
      lastActivityDate: dateOf(row.lastActivityAt, ctx.org.timezone),
      statusChangedDate: dateOf(row.statusChangedAt, ctx.org.timezone),
    },
    today,
  );

  const statusMeta = EXPERIMENT_STATUS_META[row.status];
  const priorityMeta = PRIORITY_META[row.priority];
  const stepsCompleted = stepRows.filter((s) => s.step.completedAt !== null).length;

  const canEdit = canEditExperiment(actorOf(ctx), { researcherId: row.researcherId, createdBy: row.createdById, teamId: row.teamId });

  return {
    id: row.id,
    displayId: row.displayId,
    name: row.name,
    objective: row.objective,
    hypothesis: row.hypothesis,
    status: { value: row.status, label: statusMeta.label, tone: statusMeta.tone },
    priority: { value: row.priority, label: priorityMeta.label, tone: priorityMeta.tone, rank: priorityMeta.rank },
    project: { id: row.projectId, code: row.projectCode, name: row.projectName, href: routes.project(row.projectCode) },
    experimentType: { id: row.typeId, name: row.typeName, category: row.typeCategory, color: row.typeColor },
    researcher: user({ id: row.researcherId, name: row.researcherName, title: row.researcherTitle, email: row.researcherEmail, color: row.researcherColor, avatar: row.researcherAvatar }),
    team: row.teamId ? { id: row.teamId, name: row.teamName!, color: row.teamColor! } : null,
    startDate: row.startDate,
    targetDate: row.targetDate,
    completedDate: row.completedDate,
    protocolRef: row.protocolRef,
    blockedReason: row.blockedReason,
    resultsSummary: row.resultsSummary,
    conclusion: row.conclusion,
    notes: row.notes,
    tags: tagRows,
    attention: { needsAttention: attentionReasons.length > 0, reasons: attentionReasons },
    conditions: conditionRows.map((c) => ({ id: c.id, name: c.name, value: c.value, unit: c.unit, notes: c.notes, position: c.position })),
    inputs: inputRows.map((i) => ({ id: i.id, name: i.name, inputType: { value: i.inputType, label: INPUT_TYPE_LABELS[i.inputType] }, identifier: i.identifier, quantity: i.quantity, unit: i.unit, notes: i.notes, position: i.position })),
    steps: stepRows.map((s) => ({
      id: s.step.id,
      position: s.step.position,
      title: s.step.title,
      details: s.step.details,
      durationMinutes: s.step.durationMinutes,
      completed: s.step.completedAt !== null,
      completedAt: s.step.completedAt?.toISOString() ?? null,
      completedBy: user({ id: s.cbId, name: s.cbName, title: s.cbTitle, email: s.cbEmail, color: s.cbColor, avatar: s.cbAvatar }),
    })),
    observations: observationRows.map((o) => ({
      id: o.obs.id,
      body: o.obs.body,
      significance: { value: o.obs.significance, label: OBSERVATION_SIGNIFICANCE_META[o.obs.significance].label, tone: OBSERVATION_SIGNIFICANCE_META[o.obs.significance].tone },
      observedAt: o.obs.observedAt.toISOString(),
      author: user({ id: o.aId, name: o.aName, title: o.aTitle, email: o.aEmail, color: o.aColor, avatar: o.aAvatar }),
    })),
    results: resultRows.map((r) => ({
      id: r.res.id,
      name: r.res.name,
      valueNumeric: r.res.valueNumeric,
      valueText: r.res.valueText,
      unit: r.res.unit,
      isKey: r.res.isKey,
      notes: r.res.notes,
      sample: r.sId ? { id: r.sId, displayId: r.sDisplay!, name: r.sName! } : null,
      recordedAt: r.res.recordedAt.toISOString(),
      recordedBy: user({ id: r.rbId, name: r.rbName, title: r.rbTitle, email: r.rbEmail, color: r.rbColor, avatar: r.rbAvatar }),
    })),
    samples: sampleRows.map((s) => ({
      id: s.s.id,
      displayId: s.s.displayId,
      name: s.s.name,
      sampleType: s.s.sampleType,
      status: { value: s.s.status, label: SAMPLE_STATUS_META[s.s.status].label, tone: SAMPLE_STATUS_META[s.s.status].tone },
      role: s.link.role,
      quantity: s.s.quantity,
      unit: s.s.unit,
      storageLocation: s.s.storageLocation,
      href: routes.sample(s.s.displayId),
    })),
    counts: {
      conditions: conditionRows.length,
      inputs: inputRows.length,
      steps: stepRows.length,
      stepsCompleted,
      observations: observationRows.length,
      results: resultRows.length,
      samples: sampleRows.length,
    },
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdBy: creatorRow ? user({ id: creatorRow.id, name: creatorRow.name, title: creatorRow.title, email: creatorRow.email, color: creatorRow.color, avatar: creatorRow.avatar }) : null,
    permissions: { canEdit, allowedTransitions: canEdit ? [...EXPERIMENT_TRANSITIONS[row.status]] : [] },
  };
}
