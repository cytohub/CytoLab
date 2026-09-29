import { daysBetween, type DateOnly } from './dates';
import type { ExperimentStatus } from './enums';

/**
 * "Needs attention" rules for experiments.
 *
 * These are the platform's definition of an experiment that a lead should look at.
 * The same thresholds drive the SQL filter in the experiments service
 * (see `attentionPredicate`); an integration test keeps the two in agreement.
 */
export const ATTENTION_THRESHOLDS = {
  /** In-progress experiments with no recorded activity for this many days are stale. */
  staleAfterDays: 14,
  /** Planned experiments are flagged once their start date has passed by more than this. */
  notStartedGraceDays: 2,
  /** Failures stay on the attention list for this many days so results get reviewed. */
  recentFailureDays: 7,
  /** Overdue by more than this many days escalates severity. */
  severeOverdueDays: 7,
} as const;

export type AttentionReasonCode = 'blocked' | 'overdue' | 'not_started' | 'stale' | 'recent_failure';
export type AttentionSeverity = 'high' | 'medium' | 'low';

export interface AttentionReason {
  code: AttentionReasonCode;
  severity: AttentionSeverity;
  message: string;
}

export interface AttentionInput {
  status: ExperimentStatus;
  startDate: DateOnly | null;
  targetDate: DateOnly | null;
  blockedReason: string | null;
  /** Calendar date (org time zone) of the latest recorded activity. */
  lastActivityDate: DateOnly;
  /** Calendar date (org time zone) of the latest status change. */
  statusChangedDate: DateOnly;
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { high: 0, medium: 1, low: 2 };

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function evaluateAttention(input: AttentionInput, today: DateOnly): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const t = ATTENTION_THRESHOLDS;
  const open = input.status === 'planned' || input.status === 'in_progress';

  if (open && input.blockedReason) {
    reasons.push({ code: 'blocked', severity: 'high', message: `Blocked: ${input.blockedReason}` });
  }

  if (open && input.targetDate && input.targetDate < today) {
    const days = daysBetween(input.targetDate, today);
    reasons.push({
      code: 'overdue',
      severity: days > t.severeOverdueDays ? 'high' : 'medium',
      message: `Overdue by ${plural(days, 'day')}`,
    });
  }

  if (input.status === 'planned' && input.startDate && daysBetween(input.startDate, today) > t.notStartedGraceDays) {
    reasons.push({
      code: 'not_started',
      severity: 'medium',
      message: `Scheduled start passed ${plural(daysBetween(input.startDate, today), 'day')} ago`,
    });
  }

  if (input.status === 'in_progress') {
    const idle = daysBetween(input.lastActivityDate, today);
    if (idle >= t.staleAfterDays) {
      reasons.push({ code: 'stale', severity: 'low', message: `No activity for ${plural(idle, 'day')}` });
    }
  }

  if (input.status === 'failed') {
    const since = daysBetween(input.statusChangedDate, today);
    if (since <= t.recentFailureDays) {
      reasons.push({
        code: 'recent_failure',
        severity: 'medium',
        message: since === 0 ? 'Failed today — review results' : `Failed ${plural(since, 'day')} ago — review results`,
      });
    }
  }

  return reasons.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function topSeverity(reasons: readonly AttentionReason[]): AttentionSeverity | null {
  return reasons[0]?.severity ?? null;
}

/** "Delayed" on the dashboard means past the target completion date while still open. */
export function isDelayed(reasons: readonly AttentionReason[]): boolean {
  return reasons.some((r) => r.code === 'overdue');
}
