import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { todayIn, type DateOnly } from '@/domain/dates';
import {
  computeProjectHealth,
  computeProjectProgress,
  type ExperimentCounts,
  type MilestoneCounts,
  type ProjectHealth,
  type ProjectProgress,
} from '@/domain/project-metrics';
import type { ProjectStatus } from '@/domain/enums';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { experiments, milestones } from '../../db/schema';
import { attentionCondition } from '../experiments/attention-sql';

export interface ProjectMetrics {
  progress: ProjectProgress;
  health: ProjectHealth;
  milestones: MilestoneCounts;
  experiments: ExperimentCounts;
}

const zeroMilestones: MilestoneCounts = { total: 0, completed: 0, cancelled: 0, overdue: 0 };
const zeroExperiments: ExperimentCounts = { total: 0, completed: 0, failed: 0, cancelled: 0, archived: 0, open: 0, needsAttention: 0 };

/**
 * Loads milestone and experiment roll-ups for a set of projects with two grouped
 * queries, then computes progress and health with the domain rules.
 */
export async function loadProjectMetrics(
  ctx: AuthContext,
  projects: ReadonlyArray<{ id: string; status: ProjectStatus; startDate: DateOnly | null; targetDate: DateOnly | null }>,
): Promise<Map<string, ProjectMetrics>> {
  const result = new Map<string, ProjectMetrics>();
  if (projects.length === 0) return result;

  const ids = projects.map((p) => p.id);
  const today = todayIn(ctx.org.timezone);
  const now = new Date();

  const milestoneRows = await db()
    .select({
      projectId: milestones.projectId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${milestones.status} = 'completed')::int`,
      cancelled: sql<number>`count(*) filter (where ${milestones.status} = 'cancelled')::int`,
      overdue: sql<number>`count(*) filter (where ${milestones.status} in ('pending','in_progress') and ${milestones.dueDate} is not null and ${milestones.dueDate} < ${today}::date)::int`,
    })
    .from(milestones)
    .where(and(eq(milestones.orgId, ctx.orgId), inArray(milestones.projectId, ids), isNull(milestones.deletedAt)))
    .groupBy(milestones.projectId);

  const experimentRows = await db()
    .select({
      projectId: experiments.projectId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${experiments.status} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${experiments.status} = 'failed')::int`,
      cancelled: sql<number>`count(*) filter (where ${experiments.status} = 'cancelled')::int`,
      archived: sql<number>`count(*) filter (where ${experiments.status} = 'archived')::int`,
      open: sql<number>`count(*) filter (where ${experiments.status} in ('planned','in_progress'))::int`,
      needsAttention: sql<number>`count(*) filter (where ${attentionCondition(today, now)})::int`,
    })
    .from(experiments)
    .where(and(eq(experiments.orgId, ctx.orgId), inArray(experiments.projectId, ids), isNull(experiments.deletedAt)))
    .groupBy(experiments.projectId);

  const milestoneMap = new Map(milestoneRows.map((r) => [r.projectId, r]));
  const experimentMap = new Map(experimentRows.map((r) => [r.projectId, r]));

  for (const project of projects) {
    const m: MilestoneCounts = milestoneMap.get(project.id) ?? zeroMilestones;
    const e: ExperimentCounts = experimentMap.get(project.id) ?? zeroExperiments;
    const progress = computeProjectProgress(project.status, m, e);
    const health = computeProjectHealth(
      { status: project.status, startDate: project.startDate, targetDate: project.targetDate, progress, milestones: m, experiments: e },
      today,
    );
    result.set(project.id, { progress, health, milestones: m, experiments: e });
  }
  return result;
}
