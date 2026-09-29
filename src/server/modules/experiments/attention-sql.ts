import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { ATTENTION_THRESHOLDS } from '@/domain/attention';
import { addDays, type DateOnly } from '@/domain/dates';
import { experiments } from '../../db/schema';

/**
 * SQL mirror of `evaluateAttention` (src/domain/attention.ts), used for the
 * `attention=true` filter and the dashboard "needs attention" count. An
 * integration test asserts this stays in agreement with the domain function.
 *
 * Cutoff dates are computed in JS (not with SQL date arithmetic) and date
 * parameters are cast to `date` so the comparisons are unambiguous.
 */
export function attentionCondition(today: DateOnly, now: Date): SQL {
  const t = ATTENTION_THRESHOLDS;
  const staleCutoff = new Date(now.getTime() - t.staleAfterDays * 86_400_000).toISOString();
  const failureCutoff = new Date(now.getTime() - t.recentFailureDays * 86_400_000).toISOString();
  const notStartedCutoff = addDays(today, -t.notStartedGraceDays);
  const e = experiments;
  return sql`(
    (${e.status} in ('planned','in_progress') and ${e.blockedReason} is not null)
    or (${e.status} in ('planned','in_progress') and ${e.targetDate} is not null and ${e.targetDate} < ${today}::date)
    or (${e.status} = 'planned' and ${e.startDate} is not null and ${e.startDate} < ${notStartedCutoff}::date)
    or (${e.status} = 'in_progress' and ${e.lastActivityAt} <= ${staleCutoff}::timestamptz)
    or (${e.status} = 'failed' and ${e.statusChangedAt} >= ${failureCutoff}::timestamptz)
  )`;
}

/** "Delayed" for dashboard purposes: open and past its target date. */
export function delayedCondition(today: DateOnly): SQL {
  const e = experiments;
  return sql`(${e.status} in ('planned','in_progress') and ${e.targetDate} is not null and ${e.targetDate} < ${today}::date)`;
}
