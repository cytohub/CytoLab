import 'server-only';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, type SQL } from 'drizzle-orm';
import { evaluateAttention, type AttentionReason } from '@/domain/attention';
import { todayIn, dateOf } from '@/domain/dates';
import type { ExperimentStatus, Priority } from '@/domain/enums';
import { NotFoundError } from '@/domain/errors';
import { isUuid } from '@/domain/identifiers';
import { EXPERIMENT_STATUS_META, PRIORITY_META } from '@/domain/labels';
import type { ListExperimentsQuery } from '@/domain/schemas/experiments';
import { routes } from '@/lib/routes';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { entityTags, experiments, experimentTypes, projects, tags, users } from '../../db/schema';
import { offset, pageMeta, type Paginated } from '../shared/pagination';
import { toUserSummary, type TagSummary, type UserSummary } from '../shared/presenters';
import { attentionCondition } from './attention-sql';

export interface ExperimentListItem {
  id: string;
  displayId: string;
  name: string;
  objective: string | null;
  status: { value: ExperimentStatus; label: string; tone: string };
  priority: { value: Priority; label: string; tone: string; rank: number };
  project: { id: string; code: string; name: string; href: string };
  experimentType: { id: string; name: string; color: string };
  researcher: UserSummary | null;
  startDate: string | null;
  targetDate: string | null;
  completedDate: string | null;
  blockedReason: string | null;
  tags: TagSummary[];
  attention: { needsAttention: boolean; severity: AttentionReason['severity'] | null; reasons: AttentionReason[] };
  href: string;
  updatedAt: string;
  lastActivityAt: string;
}

const SORT_COLUMNS = {
  number: experiments.number,
  name: experiments.name,
  status: experiments.status,
  priority: experiments.priority,
  startDate: experiments.startDate,
  targetDate: experiments.targetDate,
  completedDate: experiments.completedDate,
  createdAt: experiments.createdAt,
  updatedAt: experiments.updatedAt,
} as const;

function listSelect() {
  return db()
    .select({
      id: experiments.id,
      displayId: experiments.displayId,
      name: experiments.name,
      objective: experiments.objective,
      status: experiments.status,
      priority: experiments.priority,
      startDate: experiments.startDate,
      targetDate: experiments.targetDate,
      completedDate: experiments.completedDate,
      blockedReason: experiments.blockedReason,
      statusChangedAt: experiments.statusChangedAt,
      lastActivityAt: experiments.lastActivityAt,
      updatedAt: experiments.updatedAt,
      projectId: projects.id,
      projectCode: projects.code,
      projectName: projects.name,
      typeId: experimentTypes.id,
      typeName: experimentTypes.name,
      typeColor: experimentTypes.color,
      researcherId: users.id,
      researcherName: users.name,
      researcherTitle: users.title,
      researcherEmail: users.email,
      researcherColor: users.avatarColor,
      researcherAvatar: users.avatarUrl,
    })
    .from(experiments)
    .innerJoin(projects, eq(projects.id, experiments.projectId))
    .innerJoin(experimentTypes, eq(experimentTypes.id, experiments.experimentTypeId))
    .leftJoin(users, eq(users.id, experiments.researcherId));
}

type ExperimentRow = Awaited<ReturnType<ReturnType<typeof listSelect>['where']>>[number];

function evaluateRow(ctx: AuthContext, row: ExperimentRow, today: string): { needsAttention: boolean; severity: AttentionReason['severity'] | null; reasons: AttentionReason[] } {
  const reasons = evaluateAttention(
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
  return { needsAttention: reasons.length > 0, severity: reasons[0]?.severity ?? null, reasons };
}

function toListItem(ctx: AuthContext, row: ExperimentRow, tagsByExperiment: Map<string, TagSummary[]>, today: string): ExperimentListItem {
  const statusMeta = EXPERIMENT_STATUS_META[row.status];
  const priorityMeta = PRIORITY_META[row.priority];
  return {
    id: row.id,
    displayId: row.displayId,
    name: row.name,
    objective: row.objective,
    status: { value: row.status, label: statusMeta.label, tone: statusMeta.tone },
    priority: { value: row.priority, label: priorityMeta.label, tone: priorityMeta.tone, rank: priorityMeta.rank },
    project: { id: row.projectId, code: row.projectCode, name: row.projectName, href: routes.project(row.projectCode) },
    experimentType: { id: row.typeId, name: row.typeName, color: row.typeColor },
    researcher: toUserSummary(
      row.researcherId ? { id: row.researcherId, name: row.researcherName!, title: row.researcherTitle, email: row.researcherEmail!, avatarColor: row.researcherColor!, avatarUrl: row.researcherAvatar } : null,
    ),
    startDate: row.startDate,
    targetDate: row.targetDate,
    completedDate: row.completedDate,
    blockedReason: row.blockedReason,
    tags: tagsByExperiment.get(row.id) ?? [],
    attention: evaluateRow(ctx, row, today),
    href: routes.experiment(row.displayId),
    updatedAt: row.updatedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
  };
}

async function loadTagsFor(ctx: AuthContext, experimentIds: string[]): Promise<Map<string, TagSummary[]>> {
  const map = new Map<string, TagSummary[]>();
  if (experimentIds.length === 0) return map;
  const rows = await db()
    .select({ entityId: entityTags.entityId, id: tags.id, name: tags.name, color: tags.color })
    .from(entityTags)
    .innerJoin(tags, eq(tags.id, entityTags.tagId))
    .where(and(eq(entityTags.orgId, ctx.orgId), inArray(entityTags.entityId, experimentIds)))
    .orderBy(asc(tags.name));
  for (const row of rows) {
    const list = map.get(row.entityId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    map.set(row.entityId, list);
  }
  return map;
}

export async function listExperiments(ctx: AuthContext, query: Partial<ListExperimentsQuery> = {}): Promise<Paginated<ExperimentListItem>> {
  const today = todayIn(ctx.org.timezone);
  const now = new Date();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const sort = query.sort ?? { field: 'updatedAt' as const, direction: 'desc' as const };
  const filters: SQL[] = [eq(experiments.orgId, ctx.orgId), isNull(experiments.deletedAt)];

  if (query.status?.length) filters.push(inArray(experiments.status, query.status));
  if (query.projectId?.length) filters.push(inArray(experiments.projectId, query.projectId));
  if (query.researcherId?.length) filters.push(inArray(experiments.researcherId, query.researcherId));
  if (query.typeId?.length) filters.push(inArray(experiments.experimentTypeId, query.typeId));
  if (query.teamId?.length) filters.push(inArray(experiments.teamId, query.teamId));
  if (query.startFrom) filters.push(gte(experiments.startDate, query.startFrom));
  if (query.startTo) filters.push(lte(experiments.startDate, query.startTo));
  if (query.completedFrom) filters.push(gte(experiments.completedDate, query.completedFrom));
  if (query.completedTo) filters.push(lte(experiments.completedDate, query.completedTo));
  if (query.attention) filters.push(attentionCondition(today, now));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(ilike(experiments.name, term), ilike(experiments.displayId, term), ilike(experiments.objective, term))!);
  }
  if (query.tagId?.length) {
    const tagged = db()
      .select({ id: entityTags.entityId })
      .from(entityTags)
      .where(and(eq(entityTags.orgId, ctx.orgId), inArray(entityTags.tagId, query.tagId)));
    filters.push(inArray(experiments.id, tagged));
  }
  const where = and(...filters);

  const [totals] = await db().select({ total: count() }).from(experiments).where(where);
  const total = totals?.total ?? 0;
  const sortColumn = SORT_COLUMNS[sort.field];
  const direction = sort.direction === 'asc' ? asc : desc;

  const rows = await listSelect()
    .where(where)
    .orderBy(direction(sortColumn), desc(experiments.id))
    .limit(pageSize)
    .offset(offset(page, pageSize));

  const tagMap = await loadTagsFor(ctx, rows.map((r) => r.id));
  const items = rows.map((row) => toListItem(ctx, row, tagMap, today));
  return { items, meta: pageMeta(page, pageSize, total) };
}

/** Compact list used by project detail and related-experiment panels. */
export async function listExperimentsForProject(ctx: AuthContext, projectId: string, limit = 200): Promise<ExperimentListItem[]> {
  const today = todayIn(ctx.org.timezone);
  const rows = await listSelect()
    .where(and(eq(experiments.orgId, ctx.orgId), eq(experiments.projectId, projectId), isNull(experiments.deletedAt)))
    .orderBy(desc(experiments.updatedAt), desc(experiments.id))
    .limit(limit);
  const tagMap = await loadTagsFor(ctx, rows.map((r) => r.id));
  return rows.map((row) => toListItem(ctx, row, tagMap, today));
}

export async function resolveExperimentId(ctx: AuthContext, ref: string): Promise<string> {
  const byId = isUuid(ref);
  const [row] = await db()
    .select({ id: experiments.id })
    .from(experiments)
    .where(and(eq(experiments.orgId, ctx.orgId), isNull(experiments.deletedAt), byId ? eq(experiments.id, ref) : eq(experiments.displayId, ref.toUpperCase())))
    .limit(1);
  if (!row) throw new NotFoundError('Experiment');
  return row.id;
}

export { evaluateRow };
export type { ExperimentRow };
