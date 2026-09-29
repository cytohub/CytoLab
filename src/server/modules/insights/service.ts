import 'server-only';
import { and, count, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { addDays, todayIn, type DateOnly } from '@/domain/dates';
import { EXPERIMENT_STATUS_META } from '@/domain/labels';
import type { AnalyticsQuery, TimelineQuery } from '@/domain/schemas/platform';
import { routes } from '@/lib/routes';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { experiments, experimentTypes, milestones, projects, users } from '../../db/schema';
import { attentionCondition, delayedCondition } from '../experiments/attention-sql';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
  hint?: string;
}

export interface DashboardData {
  metrics: DashboardMetric[];
  experimentStatus: Array<{ status: string; label: string; tone: string; count: number }>;
  throughput: Array<{ weekStart: string; completed: number; started: number }>;
  upcomingMilestones: Array<{ id: string; displayId: string; title: string; dueDate: string | null; overdue: boolean; project: { code: string; name: string; href: string } }>;
  projectHealth: Array<{ id: string; code: string; name: string; href: string; status: string; progressPercent: number }>;
}

export async function getDashboard(ctx: AuthContext): Promise<Omit<DashboardData, 'projectHealth'> & { generatedAt: string }> {
  const today = todayIn(ctx.org.timezone);
  const now = new Date();
  const monthStart = `${today.slice(0, 7)}-01`;

  const orgExperiments = and(eq(experiments.orgId, ctx.orgId), isNull(experiments.deletedAt));

  const [projectCounts] = await db()
    .select({
      active: sql<number>`count(*) filter (where ${projects.status} = 'active')::int`,
      total: sql<number>`count(*) filter (where ${projects.status} <> 'archived')::int`,
    })
    .from(projects)
    .where(and(eq(projects.orgId, ctx.orgId), isNull(projects.deletedAt)));

  const [expCounts] = await db()
    .select({
      thisMonth: sql<number>`count(*) filter (where ${experiments.createdAt} >= ${monthStart}::date)::int`,
      completed: sql<number>`count(*) filter (where ${experiments.status} = 'completed')::int`,
      inProgress: sql<number>`count(*) filter (where ${experiments.status} = 'in_progress')::int`,
      planned: sql<number>`count(*) filter (where ${experiments.status} = 'planned')::int`,
      delayed: sql<number>`count(*) filter (where ${delayedCondition(today)})::int`,
      needsAttention: sql<number>`count(*) filter (where ${attentionCondition(today, now)})::int`,
      completedThisMonth: sql<number>`count(*) filter (where ${experiments.status} = 'completed' and ${experiments.completedDate} >= ${monthStart}::date)::int`,
    })
    .from(experiments)
    .where(orgExperiments);

  const metrics: DashboardMetric[] = [
    { key: 'active_projects', label: 'Active projects', value: projectCounts?.active ?? 0, hint: `${projectCounts?.total ?? 0} total` },
    { key: 'experiments_month', label: 'Experiments this month', value: expCounts?.thisMonth ?? 0, hint: `${expCounts?.completedThisMonth ?? 0} completed` },
    { key: 'in_progress', label: 'In progress', value: expCounts?.inProgress ?? 0, hint: `${expCounts?.planned ?? 0} planned` },
    { key: 'completed', label: 'Completed', value: expCounts?.completed ?? 0, hint: 'all time' },
    { key: 'delayed', label: 'Delayed', value: expCounts?.delayed ?? 0, hint: 'past target date' },
    { key: 'needs_attention', label: 'Needs attention', value: expCounts?.needsAttention ?? 0, hint: 'blocked, overdue or stale' },
  ];

  const statusRows = await db().select({ status: experiments.status, c: count() }).from(experiments).where(orgExperiments).groupBy(experiments.status);
  const statusMap = new Map(statusRows.map((r) => [r.status, r.c]));
  const experimentStatus = (Object.keys(EXPERIMENT_STATUS_META) as Array<keyof typeof EXPERIMENT_STATUS_META>)
    .map((status) => ({ status, label: EXPERIMENT_STATUS_META[status].label, tone: EXPERIMENT_STATUS_META[status].tone, count: statusMap.get(status) ?? 0 }))
    .filter((s) => s.count > 0);

  const throughput = (await throughputSeries(ctx, 'week', addDays(today, -11 * 7), today, [eq(experiments.orgId, ctx.orgId), isNull(experiments.deletedAt)])).map((t) => ({
    weekStart: t.periodStart,
    completed: t.completed,
    started: t.started,
  }));

  const milestoneRows = await db()
    .select({ id: milestones.id, sequence: milestones.sequence, title: milestones.title, dueDate: milestones.dueDate, code: projects.code, name: projects.name })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(and(eq(milestones.orgId, ctx.orgId), isNull(milestones.deletedAt), inArray(milestones.status, ['pending', 'in_progress']), isNull(projects.deletedAt)))
    .orderBy(sql`${milestones.dueDate} asc nulls last`)
    .limit(6);

  return {
    metrics,
    experimentStatus,
    throughput,
    upcomingMilestones: milestoneRows.map((m) => ({
      id: m.id,
      displayId: `M${m.sequence}`,
      title: m.title,
      dueDate: m.dueDate,
      overdue: m.dueDate !== null && m.dueDate < today,
      project: { code: m.code, name: m.name, href: routes.project(m.code) },
    })),
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * Completed/started counts per calendar period. Each metric is aggregated in its
 * own CTE and joined back to the period series, so the two counts never fan out
 * into a cartesian product.
 */
async function throughputSeries(
  ctx: AuthContext,
  period: 'week' | 'month',
  from: DateOnly,
  to: DateOnly,
  scope: SQL[],
): Promise<Array<{ periodStart: string; completed: number; started: number }>> {
  const where = and(...scope);
  const rows = await db().execute<{ period_start: string; completed: number; started: number }>(sql`
    with periods as (
      select generate_series(date_trunc(${period}, ${from}::date), date_trunc(${period}, ${to}::date), ('1 ' || ${period})::interval)::date as period_start
    ),
    completed as (
      select date_trunc(${period}, ${experiments.completedDate})::date as p, count(*)::int as n
      from experiments
      where ${where} and ${experiments.status} = 'completed' and ${experiments.completedDate} is not null
        and ${experiments.completedDate} >= ${from}::date and ${experiments.completedDate} <= ${to}::date
      group by 1
    ),
    started as (
      select date_trunc(${period}, ${experiments.startDate})::date as p, count(*)::int as n
      from experiments
      where ${where} and ${experiments.startDate} is not null
        and ${experiments.startDate} >= ${from}::date and ${experiments.startDate} <= ${to}::date
      group by 1
    )
    select to_char(pr.period_start, 'YYYY-MM-DD') as period_start,
      coalesce(c.n, 0)::int as completed, coalesce(s.n, 0)::int as started
    from periods pr
    left join completed c on c.p = pr.period_start
    left join started s on s.p = pr.period_start
    order by pr.period_start
  `);
  return rows.map((r) => ({ periodStart: r.period_start, completed: Number(r.completed), started: Number(r.started) }));
}

export interface AnalyticsData {
  range: string;
  granularity: string;
  throughput: Array<{ periodStart: string; completed: number; started: number }>;
  successRate: { completed: number; failed: number; ratePercent: number | null };
  timeToCompletion: { medianDays: number | null; averageDays: number | null; sampleSize: number };
  byType: Array<{ id: string; name: string; color: string; count: number }>;
  byResearcher: Array<{ id: string; name: string; initials: string; avatarColor: string; count: number }>;
  byProject: Array<{ id: string; code: string; name: string; href: string; count: number; completed: number }>;
  milestoneCompletion: { completed: number; total: number };
}

const RANGE_DAYS: Record<string, number> = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 };

export async function getAnalytics(ctx: AuthContext, query: AnalyticsQuery): Promise<AnalyticsData> {
  const today = todayIn(ctx.org.timezone);
  const from = addDays(today, -(RANGE_DAYS[query.range] ?? 180));
  const scope: SQL[] = [eq(experiments.orgId, ctx.orgId), isNull(experiments.deletedAt)];
  if (query.projectId) scope.push(eq(experiments.projectId, query.projectId));
  if (query.teamId) scope.push(eq(experiments.teamId, query.teamId));

  const period = query.granularity === 'month' ? 'month' : 'week';
  const throughput = await throughputSeries(ctx, period, from, today, scope);

  const [rates] = await db()
    .select({
      completed: sql<number>`count(*) filter (where ${experiments.status} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${experiments.status} = 'failed')::int`,
    })
    .from(experiments)
    .where(and(...scope, gte(experiments.statusChangedAt, new Date(`${from}T00:00:00Z`))));

  const [timing] = await db().execute<{ median: number | null; average: number | null; n: number }>(sql`
    select
      percentile_cont(0.5) within group (order by (completed_date - start_date))::float8 as median,
      avg(completed_date - start_date)::float8 as average,
      count(*)::int as n
    from experiments
    where ${and(...scope)} and status = 'completed' and start_date is not null and completed_date is not null
      and completed_date >= ${from}::date
  `);

  const byType = await db()
    .select({ id: experimentTypes.id, name: experimentTypes.name, color: experimentTypes.color, count: count(experiments.id) })
    .from(experiments)
    .innerJoin(experimentTypes, eq(experimentTypes.id, experiments.experimentTypeId))
    .where(and(...scope, gte(experiments.createdAt, new Date(`${from}T00:00:00Z`))))
    .groupBy(experimentTypes.id)
    .orderBy(desc(count(experiments.id)))
    .limit(12);

  const byResearcher = await db()
    .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, count: count(experiments.id) })
    .from(experiments)
    .innerJoin(users, eq(users.id, experiments.researcherId))
    .where(and(...scope, gte(experiments.createdAt, new Date(`${from}T00:00:00Z`))))
    .groupBy(users.id)
    .orderBy(desc(count(experiments.id)))
    .limit(10);

  const byProject = await db()
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      count: count(experiments.id),
      completed: sql<number>`count(*) filter (where ${experiments.status} = 'completed')::int`,
    })
    .from(experiments)
    .innerJoin(projects, eq(projects.id, experiments.projectId))
    .where(and(...scope, gte(experiments.createdAt, new Date(`${from}T00:00:00Z`))))
    .groupBy(projects.id)
    .orderBy(desc(count(experiments.id)))
    .limit(10);

  const [milestoneCompletion] = await db()
    .select({
      completed: sql<number>`count(*) filter (where ${milestones.status} = 'completed')::int`,
      total: sql<number>`count(*) filter (where ${milestones.status} <> 'cancelled')::int`,
    })
    .from(milestones)
    .where(and(eq(milestones.orgId, ctx.orgId), isNull(milestones.deletedAt)));

  const completed = rates?.completed ?? 0;
  const failed = rates?.failed ?? 0;
  const decided = completed + failed;

  return {
    range: query.range,
    granularity: query.granularity,
    throughput,
    successRate: { completed, failed, ratePercent: decided > 0 ? Math.round((completed / decided) * 100) : null },
    timeToCompletion: {
      medianDays: timing?.median != null ? Math.round(Number(timing.median)) : null,
      averageDays: timing?.average != null ? Math.round(Number(timing.average)) : null,
      sampleSize: timing?.n ?? 0,
    },
    byType: byType.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t.count })),
    byResearcher: byResearcher.map((r) => ({ id: r.id, name: r.name, initials: r.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(), avatarColor: r.avatarColor, count: r.count })),
    byProject: byProject.map((p) => ({ id: p.id, code: p.code, name: p.name, href: routes.project(p.code), count: p.count, completed: Number(p.completed) })),
    milestoneCompletion: { completed: milestoneCompletion?.completed ?? 0, total: milestoneCompletion?.total ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  id: string;
  kind: 'experiment_started' | 'experiment_completed' | 'experiment_failed' | 'milestone' | 'project_started';
  date: DateOnly;
  title: string;
  displayId: string | null;
  href: string;
  status?: string;
  tone: string;
  project: { code: string; name: string } | null;
}

export async function getTimeline(ctx: AuthContext, query: TimelineQuery): Promise<{ from: DateOnly; to: DateOnly; events: TimelineEvent[] }> {
  const today = todayIn(ctx.org.timezone);
  const from = query.from ?? addDays(today, -60);
  const to = query.to ?? addDays(today, 30);

  const scope: SQL[] = [eq(experiments.orgId, ctx.orgId), isNull(experiments.deletedAt)];
  if (query.projectId?.length) scope.push(inArray(experiments.projectId, query.projectId));
  if (query.teamId) scope.push(eq(experiments.teamId, query.teamId));
  if (query.researcherId) scope.push(eq(experiments.researcherId, query.researcherId));

  const expRows = await db()
    .select({
      id: experiments.id,
      displayId: experiments.displayId,
      name: experiments.name,
      status: experiments.status,
      startDate: experiments.startDate,
      completedDate: experiments.completedDate,
      code: projects.code,
      projectName: projects.name,
    })
    .from(experiments)
    .innerJoin(projects, eq(projects.id, experiments.projectId))
    .where(and(...scope))
    .limit(500);

  const events: TimelineEvent[] = [];
  for (const e of expRows) {
    if (e.startDate && e.startDate >= from && e.startDate <= to) {
      events.push({ id: `${e.id}:start`, kind: 'experiment_started', date: e.startDate, title: e.name, displayId: e.displayId, href: routes.experiment(e.displayId), status: e.status, tone: 'blue', project: { code: e.code, name: e.projectName } });
    }
    if (e.completedDate && e.completedDate >= from && e.completedDate <= to && (e.status === 'completed' || e.status === 'failed')) {
      events.push({
        id: `${e.id}:end`,
        kind: e.status === 'failed' ? 'experiment_failed' : 'experiment_completed',
        date: e.completedDate,
        title: e.name,
        displayId: e.displayId,
        href: routes.experiment(e.displayId),
        status: e.status,
        tone: e.status === 'failed' ? 'red' : 'green',
        project: { code: e.code, name: e.projectName },
      });
    }
  }

  const milestoneScope: SQL[] = [eq(milestones.orgId, ctx.orgId), isNull(milestones.deletedAt), gte(milestones.dueDate, from), lte(milestones.dueDate, to)];
  if (query.projectId?.length) milestoneScope.push(inArray(milestones.projectId, query.projectId));
  const mRows = await db()
    .select({ id: milestones.id, sequence: milestones.sequence, title: milestones.title, dueDate: milestones.dueDate, status: milestones.status, code: projects.code, name: projects.name })
    .from(milestones)
    .innerJoin(projects, and(eq(projects.id, milestones.projectId), isNull(projects.deletedAt)))
    .where(and(...milestoneScope));
  for (const m of mRows) {
    if (!m.dueDate) continue;
    events.push({ id: m.id, kind: 'milestone', date: m.dueDate, title: m.title, displayId: `M${m.sequence}`, href: routes.project(m.code), status: m.status, tone: m.status === 'completed' ? 'green' : 'violet', project: { code: m.code, name: m.name } });
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { from, to, events };
}
