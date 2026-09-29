import { daysBetween, type DateOnly } from './dates';
import type { ProjectStatus } from './enums';

/**
 * Project progress and health are computed, not typed in, so they cannot drift
 * from the underlying record. Every result carries its basis/reasons so the UI
 * can explain the number.
 */

export interface MilestoneCounts {
  total: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface ExperimentCounts {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  archived: number;
  /** Open experiments (planned or in progress). */
  open: number;
  needsAttention: number;
}

export type ProgressBasis = 'milestones' | 'experiments' | 'status' | 'none';

export interface ProjectProgress {
  percent: number;
  basis: ProgressBasis;
  done: number;
  scope: number;
}

export function computeProjectProgress(
  status: ProjectStatus,
  milestones: MilestoneCounts,
  experiments: ExperimentCounts,
): ProjectProgress {
  if (status === 'completed') return { percent: 100, basis: 'status', done: 1, scope: 1 };

  const milestoneScope = milestones.total - milestones.cancelled;
  if (milestoneScope > 0) {
    return {
      percent: Math.round((milestones.completed / milestoneScope) * 100),
      basis: 'milestones',
      done: milestones.completed,
      scope: milestoneScope,
    };
  }

  const experimentScope = experiments.total - experiments.cancelled - experiments.archived;
  if (experimentScope > 0) {
    return {
      percent: Math.round((experiments.completed / experimentScope) * 100),
      basis: 'experiments',
      done: experiments.completed,
      scope: experimentScope,
    };
  }

  return { percent: 0, basis: 'none', done: 0, scope: 0 };
}

export const HEALTH_THRESHOLDS = {
  /** Percentage points behind the time-elapsed line that count as "behind schedule". */
  atRiskScheduleGap: 20,
  offTrackScheduleGap: 40,
  offTrackOverdueMilestones: 2,
  /** Open experiments needing attention that put a project at risk. */
  atRiskAttentionCount: 3,
} as const;

export type HealthStatus = 'on_track' | 'at_risk' | 'off_track' | 'inactive';

export interface HealthReason {
  severity: 'off_track' | 'at_risk';
  message: string;
}

export interface ProjectHealth {
  status: HealthStatus;
  reasons: HealthReason[];
  /** Share of the planned timeline that has elapsed (0–100), when dates allow. */
  expectedPercent: number | null;
}

export interface HealthInput {
  status: ProjectStatus;
  startDate: DateOnly | null;
  targetDate: DateOnly | null;
  progress: ProjectProgress;
  milestones: MilestoneCounts;
  experiments: ExperimentCounts;
}

export function expectedProgress(startDate: DateOnly | null, targetDate: DateOnly | null, today: DateOnly): number | null {
  if (!startDate || !targetDate) return null;
  const span = daysBetween(startDate, targetDate);
  if (span <= 0) return null;
  const elapsed = daysBetween(startDate, today);
  return Math.min(100, Math.max(0, Math.round((elapsed / span) * 100)));
}

export function computeProjectHealth(input: HealthInput, today: DateOnly): ProjectHealth {
  if (input.status !== 'active' && input.status !== 'planning') {
    return { status: 'inactive', reasons: [], expectedPercent: null };
  }

  const t = HEALTH_THRESHOLDS;
  const reasons: HealthReason[] = [];
  const expectedPercent = expectedProgress(input.startDate, input.targetDate, today);

  if (input.targetDate && input.targetDate < today) {
    reasons.push({
      severity: 'off_track',
      message: `Target date passed ${daysBetween(input.targetDate, today)} days ago`,
    });
  }

  const overdue = input.milestones.overdue;
  if (overdue >= t.offTrackOverdueMilestones) {
    reasons.push({ severity: 'off_track', message: `${overdue} milestones overdue` });
  } else if (overdue === 1) {
    reasons.push({ severity: 'at_risk', message: '1 milestone overdue' });
  }

  // Schedule variance only applies to active work with a basis for progress.
  if (input.status === 'active' && expectedPercent !== null && input.progress.basis !== 'none') {
    const gap = expectedPercent - input.progress.percent;
    if (gap >= t.offTrackScheduleGap) {
      reasons.push({ severity: 'off_track', message: `${gap} points behind schedule` });
    } else if (gap >= t.atRiskScheduleGap) {
      reasons.push({ severity: 'at_risk', message: `${gap} points behind schedule` });
    }
  }

  if (input.experiments.needsAttention >= t.atRiskAttentionCount) {
    reasons.push({ severity: 'at_risk', message: `${input.experiments.needsAttention} experiments need attention` });
  }

  const status: HealthStatus = reasons.some((r) => r.severity === 'off_track')
    ? 'off_track'
    : reasons.length > 0
      ? 'at_risk'
      : 'on_track';

  reasons.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'off_track' ? -1 : 1));
  return { status, reasons, expectedPercent };
}

export const HEALTH_META: Record<HealthStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'muted' }> = {
  on_track: { label: 'On track', tone: 'green' },
  at_risk: { label: 'At risk', tone: 'amber' },
  off_track: { label: 'Off track', tone: 'red' },
  inactive: { label: 'Inactive', tone: 'muted' },
};
