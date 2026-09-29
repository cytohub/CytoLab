import 'server-only';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { todayIn } from '@/domain/dates';
import { diffFields, hasChanges } from '@/domain/diff';
import type { Priority, ProjectStatus } from '@/domain/enums';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { EXPERIMENT_STATUS_META, PRIORITY_META, PROJECT_STATUS_META } from '@/domain/labels';
import { canDeleteProject, canEditProject } from '@/domain/permissions';
import type { HealthStatus, ProjectHealth, ProjectProgress } from '@/domain/project-metrics';
import { HEALTH_META } from '@/domain/project-metrics';
import type { CreateProjectData, ListProjectsQuery, UpdateProjectData } from '@/domain/schemas/projects';
import { canTransitionProject, projectTransitionEffects } from '@/domain/workflows';
import { routes } from '@/lib/routes';
import { actorOf, type AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db } from '../../db/client';
import { experiments, milestones, projects, researchAreas, teams, users } from '../../db/schema';
import { registerEntity, setEntityDeleted, syncEntityLabel } from '../../platform/entities';
import { recordEvent } from '../../platform/events';
import { indexExperiments, indexProjects } from '../search/indexers';
import { offset, pageMeta, type Paginated } from '../shared/pagination';
import { toUserSummary, type TeamSummary, type UserSummary } from '../shared/presenters';
import { loadProjectMetrics, type ProjectMetrics } from './metrics';

export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: { value: ProjectStatus; label: string; tone: string };
  priority: { value: Priority; label: string; tone: string; rank: number };
  researchArea: { id: string; name: string; color: string } | null;
  owner: UserSummary | null;
  team: TeamSummary | null;
  startDate: string | null;
  targetDate: string | null;
  progressPercent: number;
  progressBasis: ProjectProgress['basis'];
  health: { status: HealthStatus; label: string; tone: string };
  experimentCount: number;
  openExperimentCount: number;
  needsAttentionCount: number;
  milestoneProgress: { completed: number; total: number };
  href: string;
  updatedAt: string;
}

const SORT_COLUMNS = {
  name: projects.name,
  code: projects.code,
  status: projects.status,
  priority: projects.priority,
  targetDate: projects.targetDate,
  startDate: projects.startDate,
  updatedAt: projects.updatedAt,
} as const;

function baseSelect() {
  return db()
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      priority: projects.priority,
      startDate: projects.startDate,
      targetDate: projects.targetDate,
      completedAt: projects.completedAt,
      notes: projects.notes,
      version: projects.version,
      updatedAt: projects.updatedAt,
      createdAt: projects.createdAt,
      ownerId: projects.ownerId,
      teamId: projects.teamId,
      researchAreaId: projects.researchAreaId,
      areaName: researchAreas.name,
      areaColor: researchAreas.color,
      teamName: teams.name,
      teamColor: teams.color,
      ownerName: users.name,
      ownerTitle: users.title,
      ownerEmail: users.email,
      ownerColor: users.avatarColor,
      ownerAvatar: users.avatarUrl,
    })
    .from(projects)
    .leftJoin(researchAreas, eq(researchAreas.id, projects.researchAreaId))
    .leftJoin(teams, eq(teams.id, projects.teamId))
    .leftJoin(users, eq(users.id, projects.ownerId));
}

type ProjectRow = Awaited<ReturnType<ReturnType<typeof baseSelect>['where']>>[number];

function toListItem(row: ProjectRow, metrics: ProjectMetrics): ProjectListItem {
  const statusMeta = PROJECT_STATUS_META[row.status];
  const priorityMeta = PRIORITY_META[row.priority];
  const healthMeta = HEALTH_META[metrics.health.status];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: { value: row.status, label: statusMeta.label, tone: statusMeta.tone },
    priority: { value: row.priority, label: priorityMeta.label, tone: priorityMeta.tone, rank: priorityMeta.rank },
    researchArea: row.researchAreaId ? { id: row.researchAreaId, name: row.areaName!, color: row.areaColor! } : null,
    owner: toUserSummary(
      row.ownerId ? { id: row.ownerId, name: row.ownerName!, title: row.ownerTitle, email: row.ownerEmail!, avatarColor: row.ownerColor!, avatarUrl: row.ownerAvatar } : null,
    ),
    team: row.teamId ? { id: row.teamId, name: row.teamName!, color: row.teamColor! } : null,
    startDate: row.startDate,
    targetDate: row.targetDate,
    progressPercent: metrics.progress.percent,
    progressBasis: metrics.progress.basis,
    health: { status: metrics.health.status, label: healthMeta.label, tone: healthMeta.tone },
    experimentCount: metrics.experiments.total,
    openExperimentCount: metrics.experiments.open,
    needsAttentionCount: metrics.experiments.needsAttention,
    milestoneProgress: { completed: metrics.milestones.completed, total: metrics.milestones.total - metrics.milestones.cancelled },
    href: routes.project(row.code),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjects(ctx: AuthContext, query: Partial<ListProjectsQuery> = {}): Promise<Paginated<ProjectListItem>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const sort = query.sort ?? { field: 'updatedAt' as const, direction: 'desc' as const };

  const filters: SQL[] = [eq(projects.orgId, ctx.orgId), isNull(projects.deletedAt)];
  if (query.status?.length) filters.push(inArray(projects.status, query.status));
  if (query.teamId?.length) filters.push(inArray(projects.teamId, query.teamId));
  if (query.ownerId?.length) filters.push(inArray(projects.ownerId, query.ownerId));
  if (query.researchAreaId?.length) filters.push(inArray(projects.researchAreaId, query.researchAreaId));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(ilike(projects.name, term), ilike(projects.code, term))!);
  }
  const where = and(...filters);

  const [totals] = await db().select({ total: count() }).from(projects).where(where);
  const total = totals?.total ?? 0;
  const sortColumn = SORT_COLUMNS[sort.field];
  const direction = sort.direction === 'asc' ? asc : desc;

  const rows = await baseSelect()
    .where(where)
    .orderBy(direction(sortColumn), desc(projects.id))
    .limit(pageSize)
    .offset(offset(page, pageSize));

  const metrics = await loadProjectMetrics(ctx, rows);
  const items = rows.map((row) => toListItem(row, metrics.get(row.id)!));
  return { items, meta: pageMeta(page, pageSize, total) };
}

async function loadProjectRow(ctx: AuthContext, ref: string): Promise<ProjectRow> {
  const byCode = !/^[0-9a-f]{8}-/i.test(ref);
  const condition = byCode ? eq(projects.code, ref.toUpperCase()) : eq(projects.id, ref);
  const [row] = await baseSelect()
    .where(and(eq(projects.orgId, ctx.orgId), isNull(projects.deletedAt), condition))
    .limit(1);
  if (!row) throw new NotFoundError('Project');
  return row;
}

export interface MilestoneView {
  id: string;
  sequence: number;
  displayId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: { value: string; label: string; tone: string };
  completedAt: string | null;
  overdue: boolean;
  owner: UserSummary | null;
  position: number;
}

export interface ProjectDetail extends ProjectListItem {
  notes: string | null;
  version: number;
  createdAt: string;
  health: { status: HealthStatus; label: string; tone: string; reasons: ProjectHealth['reasons']; expectedPercent: number | null };
  milestones: MilestoneView[];
  experimentStatusBreakdown: Array<{ status: string; label: string; tone: string; count: number }>;
  permissions: { canEdit: boolean; canDelete: boolean; canManageMilestones: boolean };
}

export async function getProject(ctx: AuthContext, ref: string): Promise<ProjectDetail> {
  const row = await loadProjectRow(ctx, ref);
  const metrics = (await loadProjectMetrics(ctx, [row])).get(row.id)!;
  const today = todayIn(ctx.org.timezone);

  const milestoneRows = await db()
    .select({
      id: milestones.id,
      sequence: milestones.sequence,
      title: milestones.title,
      description: milestones.description,
      dueDate: milestones.dueDate,
      status: milestones.status,
      completedAt: milestones.completedAt,
      position: milestones.position,
      ownerId: users.id,
      ownerName: users.name,
      ownerTitle: users.title,
      ownerEmail: users.email,
      ownerColor: users.avatarColor,
      ownerAvatar: users.avatarUrl,
    })
    .from(milestones)
    .leftJoin(users, eq(users.id, milestones.ownerId))
    .where(and(eq(milestones.orgId, ctx.orgId), eq(milestones.projectId, row.id), isNull(milestones.deletedAt)))
    .orderBy(asc(milestones.position), asc(milestones.sequence));

  const milestoneViews: MilestoneView[] = milestoneRows.map((m) => {
    const meta = { pending: { label: 'Pending', tone: 'neutral' }, in_progress: { label: 'In progress', tone: 'blue' }, completed: { label: 'Reached', tone: 'green' }, cancelled: { label: 'Cancelled', tone: 'muted' } }[m.status];
    return {
      id: m.id,
      sequence: m.sequence,
      displayId: `M${m.sequence}`,
      title: m.title,
      description: m.description,
      dueDate: m.dueDate,
      status: { value: m.status, label: meta.label, tone: meta.tone },
      completedAt: m.completedAt?.toISOString() ?? null,
      overdue: (m.status === 'pending' || m.status === 'in_progress') && m.dueDate !== null && m.dueDate < today,
      owner: toUserSummary(m.ownerId ? { id: m.ownerId, name: m.ownerName!, title: m.ownerTitle, email: m.ownerEmail!, avatarColor: m.ownerColor!, avatarUrl: m.ownerAvatar } : null),
      position: m.position,
    };
  });

  const breakdown = Object.entries(
    (
      await db()
        .select({ status: experiments.status, c: count() })
        .from(experiments)
        .where(and(eq(experiments.orgId, ctx.orgId), eq(experiments.projectId, row.id), isNull(experiments.deletedAt)))
        .groupBy(experiments.status)
    ).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: r.c }), {}),
  ).map(([status, c]) => ({ status, label: EXPERIMENT_STATUS_META[status as keyof typeof EXPERIMENT_STATUS_META].label, tone: EXPERIMENT_STATUS_META[status as keyof typeof EXPERIMENT_STATUS_META].tone, count: c }));

  const actor = actorOf(ctx);
  const policyTarget = { ownerId: row.ownerId, teamId: row.teamId };
  const healthMeta = HEALTH_META[metrics.health.status];

  return {
    ...toListItem(row, metrics),
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    health: { status: metrics.health.status, label: healthMeta.label, tone: healthMeta.tone, reasons: metrics.health.reasons, expectedPercent: metrics.health.expectedPercent },
    milestones: milestoneViews,
    experimentStatusBreakdown: breakdown,
    permissions: {
      canEdit: canEditProject(actor, policyTarget),
      canDelete: canDeleteProject(actor, policyTarget),
      canManageMilestones: canEditProject(actor, policyTarget),
    },
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function assertRefsExist(ctx: AuthContext, refs: { ownerId?: string; teamId?: string | null; researchAreaId?: string | null }) {
  if (refs.ownerId) {
    const [owner] = await db().select({ id: users.id }).from(users).where(eq(users.id, refs.ownerId)).limit(1);
    if (!owner) throw new ValidationError('Owner is invalid', { ownerId: ['Unknown user'] });
  }
  if (refs.teamId) {
    const [team] = await db().select({ id: teams.id }).from(teams).where(and(eq(teams.id, refs.teamId), eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt))).limit(1);
    if (!team) throw new ValidationError('Team is invalid', { teamId: ['Unknown team'] });
  }
  if (refs.researchAreaId) {
    const [area] = await db().select({ id: researchAreas.id }).from(researchAreas).where(and(eq(researchAreas.id, refs.researchAreaId), eq(researchAreas.orgId, ctx.orgId))).limit(1);
    if (!area) throw new ValidationError('Research area is invalid', { researchAreaId: ['Unknown research area'] });
  }
}

export async function createProject(ctx: AuthContext, input: CreateProjectData): Promise<ProjectDetail> {
  authorize(ctx, 'project:create');
  await assertRefsExist(ctx, input);

  const projectId = await db()
    .transaction(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();
      // Both the entity registry and the projects table enforce code uniqueness;
      // a violation on either is translated to a validation error below.
      await registerEntity(tx, { id, orgId: ctx.orgId, entityType: 'project', displayId: input.code, title: input.name, createdBy: ctx.userId, createdAt: now });
      await tx.insert(projects).values({
        id,
        orgId: ctx.orgId,
        code: input.code,
        name: input.name,
        description: input.description,
        researchAreaId: input.researchAreaId,
        ownerId: input.ownerId,
        teamId: input.teamId,
        status: input.status,
        priority: input.priority,
        startDate: input.startDate,
        targetDate: input.targetDate,
        completedAt: input.status === 'completed' ? now : null,
        notes: input.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      await recordEvent(tx, ctx, {
        action: 'project.created',
        entityId: id,
        projectId: id,
        payload: { code: input.code, name: input.name },
        audit: { action: 'create', resourceType: 'project', resourceId: id, changes: null },
      });
      await indexProjects(tx, ctx.orgId, [id]);
      return id;
    })
    .catch((err) => {
      throw translateProjectConflict(err);
    });

  return getProject(ctx, projectId);
}

export async function updateProject(ctx: AuthContext, ref: string, input: UpdateProjectData): Promise<ProjectDetail> {
  authorize(ctx, 'project:update');
  const current = await loadProjectRow(ctx, ref);
  if (!canEditProject(actorOf(ctx), { ownerId: current.ownerId, teamId: current.teamId })) {
    throw new ForbiddenError('You can only edit projects you own or that belong to your team');
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
    throw new ConflictError('This project was changed by someone else. Reload and try again.', { currentVersion: current.version });
  }
  await assertRefsExist(ctx, input);

  const { expectedVersion: _v, ...patch } = input;
  if (patch.status && patch.status !== current.status && !canTransitionProject(current.status, patch.status)) {
    throw new ValidationError('Invalid status change', { status: [`Cannot move from ${PROJECT_STATUS_META[current.status].label} to ${PROJECT_STATUS_META[patch.status].label}`] });
  }

  const changes = diffFields(
    { code: current.code, name: current.name, description: current.description, researchAreaId: current.researchAreaId, ownerId: current.ownerId, teamId: current.teamId, status: current.status, priority: current.priority, startDate: current.startDate, targetDate: current.targetDate, notes: current.notes },
    patch,
  );
  if (!hasChanges(changes)) return getProject(ctx, current.id);

  await db().transaction(async (tx) => {
    const now = new Date();
    const statusEffects = patch.status && patch.status !== current.status ? projectTransitionEffects(patch.status, now) : {};
    try {
      await tx
        .update(projects)
        .set({ ...patch, ...statusEffects, version: current.version + 1, updatedBy: ctx.userId, updatedAt: now })
        .where(eq(projects.id, current.id));
    } catch (err) {
      throw translateProjectConflict(err);
    }
    if (patch.code || patch.name) await syncEntityLabel(tx, current.id, { displayId: patch.code, title: patch.name });

    if (patch.status && patch.status !== current.status) {
      await recordEvent(tx, ctx, {
        action: 'project.status_changed',
        entityId: current.id,
        projectId: current.id,
        payload: { from: current.status, to: patch.status, name: current.name },
        audit: { action: 'status_change', resourceType: 'project', resourceId: current.id, changes },
      });
    } else {
      await recordEvent(tx, ctx, {
        action: 'project.updated',
        entityId: current.id,
        projectId: current.id,
        payload: { fields: Object.keys(changes) },
        audit: { action: 'update', resourceType: 'project', resourceId: current.id, changes },
      });
    }
    await indexProjects(tx, ctx.orgId, [current.id]);
    if (patch.code) await indexExperiments(tx, ctx.orgId); // experiment subtitles embed the project code
  });

  return getProject(ctx, current.id);
}

export async function deleteProject(ctx: AuthContext, ref: string): Promise<void> {
  authorize(ctx, 'project:delete');
  const current = await loadProjectRow(ctx, ref);
  if (!canDeleteProject(actorOf(ctx), { ownerId: current.ownerId, teamId: current.teamId })) {
    throw new ForbiddenError('You can only delete projects you own');
  }
  const [openRow] = await db()
    .select({ openExperiments: count() })
    .from(experiments)
    .where(and(eq(experiments.orgId, ctx.orgId), eq(experiments.projectId, current.id), isNull(experiments.deletedAt), inArray(experiments.status, ['planned', 'in_progress'])));
  const openExperiments = openRow?.openExperiments ?? 0;
  if (openExperiments > 0) {
    throw new ConflictError('Archive or move the open experiments before deleting this project', { openExperiments });
  }

  await db().transaction(async (tx) => {
    const now = new Date();
    await tx.update(projects).set({ deletedAt: now, updatedBy: ctx.userId, updatedAt: now }).where(eq(projects.id, current.id));
    await setEntityDeleted(tx, current.id, now);
    await recordEvent(tx, ctx, {
      action: 'project.deleted',
      entityId: current.id,
      projectId: current.id,
      payload: { code: current.code, name: current.name },
      audit: { action: 'delete', resourceType: 'project', resourceId: current.id, changes: null },
    });
    await indexProjects(tx, ctx.orgId, [current.id]);
  });
}

function translateProjectConflict(err: unknown): unknown {
  // Drizzle wraps the driver error; the pg code may be on the error or its cause.
  const codes = [err, (err as { cause?: unknown })?.cause]
    .map((e) => (e && typeof e === 'object' ? (e as { code?: string }).code : undefined));
  if (codes.includes('23505')) {
    return new ValidationError('That project code is already in use', { code: ['Choose a different project code'] });
  }
  return err;
}
