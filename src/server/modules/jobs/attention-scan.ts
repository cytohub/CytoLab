import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { evaluateAttention, topSeverity } from '@/domain/attention';
import { dateOf, todayIn } from '@/domain/dates';
import { db } from '../../db/client';
import { experiments, notifications, organizations, projects } from '../../db/schema';
import { logger } from '../../lib/logger';

/**
 * Scans open experiments and notifies their researcher when one needs attention.
 * A per-day dedupe key keeps repeated runs idempotent (one alert per experiment
 * per day). Intended to run on a schedule; safe to invoke ad hoc.
 */
export async function runAttentionScan(): Promise<{ organizations: number; notified: number }> {
  const orgs = await db().select({ id: organizations.id, timezone: organizations.timezone }).from(organizations);
  let notified = 0;

  for (const org of orgs) {
    const today = todayIn(org.timezone);
    const rows = await db()
      .select({
        id: experiments.id,
        displayId: experiments.displayId,
        name: experiments.name,
        status: experiments.status,
        startDate: experiments.startDate,
        targetDate: experiments.targetDate,
        blockedReason: experiments.blockedReason,
        lastActivityAt: experiments.lastActivityAt,
        statusChangedAt: experiments.statusChangedAt,
        researcherId: experiments.researcherId,
      })
      .from(experiments)
      .innerJoin(projects, and(eq(projects.id, experiments.projectId), isNull(projects.deletedAt)))
      .where(and(eq(experiments.orgId, org.id), isNull(experiments.deletedAt)));

    const pending: Array<typeof notifications.$inferInsert> = [];
    for (const row of rows) {
      const reasons = evaluateAttention(
        {
          status: row.status,
          startDate: row.startDate,
          targetDate: row.targetDate,
          blockedReason: row.blockedReason,
          lastActivityDate: dateOf(row.lastActivityAt, org.timezone),
          statusChangedDate: dateOf(row.statusChangedAt, org.timezone),
        },
        today,
      );
      const severity = topSeverity(reasons);
      // Only high/medium severity generates a proactive alert; low (stale) is shown in-app only.
      if (!severity || severity === 'low') continue;

      pending.push({
        orgId: org.id,
        recipientId: row.researcherId,
        type: 'attention',
        entityId: row.id,
        title: `${row.displayId} needs attention`,
        body: reasons.map((r) => r.message).join(' · '),
        dedupeKey: `attention:${row.id}:${today}`,
      });
    }

    if (pending.length > 0) {
      const inserted = await db().insert(notifications).values(pending).onConflictDoNothing().returning({ id: notifications.id });
      notified += inserted.length;
    }
  }

  logger.info('attention scan complete', { organizations: orgs.length, notified });
  return { organizations: orgs.length, notified };
}
