import 'server-only';
import type { FieldChanges } from '@/domain/diff';
import type { NotificationType } from '@/domain/enums';
import type { AuthContext } from '../auth/context';
import type { Executor } from '../db/client';
import { activityEvents, auditLog, notifications } from '../db/schema';

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'status_change' | 'link' | 'unlink' | 'login' | 'logout';

export interface NotificationSpec {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  dedupeKey?: string;
}

export interface EventSpec {
  /** Namespaced verb shown in the activity feed, e.g. `experiment.status_changed`. */
  action: string;
  entityId?: string | null;
  projectId?: string | null;
  payload?: Record<string, unknown>;
  /** Write a feed entry (default true). Audit-only changes set this to false. */
  activity?: boolean;
  audit?: {
    action: AuditAction;
    resourceType: string;
    resourceId: string | null;
    changes?: FieldChanges | null;
  };
  notify?: NotificationSpec[];
}

/**
 * The single write path for side effects of a mutation. Runs inside the caller's
 * transaction so the change, its audit record, its feed entry, and its
 * notifications commit or roll back together.
 *
 * Future: this becomes a transactional outbox drained by workers (email, Slack,
 * webhooks, AI summarization) without changing callers.
 */
export async function recordEvent(tx: Executor, ctx: AuthContext, spec: EventSpec): Promise<{ activityId: string | null }> {
  let activityId: string | null = null;

  if (spec.activity !== false) {
    const [row] = await tx
      .insert(activityEvents)
      .values({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        actorType: ctx.actorType,
        action: spec.action,
        entityId: spec.entityId ?? null,
        projectId: spec.projectId ?? null,
        payload: spec.payload ?? {},
      })
      .returning({ id: activityEvents.id });
    activityId = row?.id ?? null;
  }

  if (spec.audit) {
    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorType: ctx.actorType,
      action: spec.audit.action,
      resourceType: spec.audit.resourceType,
      resourceId: spec.audit.resourceId,
      changes: spec.audit.changes ?? null,
      metadata: { requestId: ctx.requestId, ip: ctx.ip, userAgent: ctx.userAgent, event: spec.action },
    });
  }

  const recipients = dedupeRecipients(spec.notify ?? [], ctx.userId);
  if (recipients.length > 0) {
    await tx
      .insert(notifications)
      .values(
        recipients.map((n) => ({
          orgId: ctx.orgId,
          recipientId: n.recipientId,
          type: n.type,
          entityId: spec.entityId ?? null,
          actorId: ctx.userId,
          activityEventId: activityId,
          title: n.title,
          body: n.body ?? null,
          dedupeKey: n.dedupeKey ?? null,
        })),
      )
      .onConflictDoNothing();
  }

  return { activityId };
}

/** People are never notified about their own actions, and at most once per event. */
export function dedupeRecipients(specs: readonly NotificationSpec[], actorId: string): NotificationSpec[] {
  const seen = new Set<string>();
  return specs.filter((n) => {
    if (n.recipientId === actorId || seen.has(n.recipientId)) return false;
    seen.add(n.recipientId);
    return true;
  });
}

/** Audit entry for events outside a tenant context (e.g. failed sign-in). */
export async function recordSystemAudit(
  tx: Executor,
  entry: {
    orgId: string | null;
    actorId: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(auditLog).values({ ...entry, actorType: entry.actorId ? 'user' : 'system', changes: null });
}
