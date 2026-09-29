import 'server-only';
import { and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { NotificationType } from '@/domain/enums';
import { entityHref } from '@/lib/routes';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { entities, notifications, users } from '../../db/schema';
import { initialsOf } from '../shared/presenters';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string; initials: string; avatarColor: string; avatarUrl: string | null } | null;
  entity: { id: string; type: string; displayId: string; title: string; href: string } | null;
}

export async function listNotifications(
  ctx: AuthContext,
  query: { unread?: boolean; before?: string; limit: number },
): Promise<{ items: NotificationItem[]; nextCursor: string | null; unreadCount: number }> {
  const filters = [eq(notifications.recipientId, ctx.userId), eq(notifications.orgId, ctx.orgId)];
  if (query.unread) filters.push(isNull(notifications.readAt));
  if (query.before) {
    const before = new Date(query.before);
    if (!Number.isNaN(before.getTime())) filters.push(lt(notifications.createdAt, before));
  }

  const rows = await db()
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorId: users.id,
      actorName: users.name,
      actorColor: users.avatarColor,
      actorAvatar: users.avatarUrl,
      entityId: entities.id,
      entityType: entities.entityType,
      entityDisplayId: entities.displayId,
      entityTitle: entities.title,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(entities, eq(entities.id, notifications.entityId))
    .where(and(...filters))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const unreadCount = await unreadNotificationCount(ctx);

  return {
    items: page.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
      actor: row.actorId ? { id: row.actorId, name: row.actorName!, initials: initialsOf(row.actorName!), avatarColor: row.actorColor!, avatarUrl: row.actorAvatar } : null,
      entity: row.entityId ? { id: row.entityId, type: row.entityType!, displayId: row.entityDisplayId!, title: row.entityTitle!, href: entityHref(row.entityType!, row.entityDisplayId!) } : null,
    })),
    nextCursor: hasMore && page.length ? page[page.length - 1]!.createdAt.toISOString() : null,
    unreadCount,
  };
}

export async function unreadNotificationCount(ctx: AuthContext): Promise<number> {
  const [row] = await db()
    .select({ c: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, ctx.userId), eq(notifications.orgId, ctx.orgId), isNull(notifications.readAt)));
  return row?.c ?? 0;
}

export async function markNotifications(ctx: AuthContext, input: { ids?: string[]; all?: boolean }): Promise<{ updated: number }> {
  const filters = [eq(notifications.recipientId, ctx.userId), eq(notifications.orgId, ctx.orgId), isNull(notifications.readAt)];
  if (!input.all) filters.push(inArray(notifications.id, input.ids ?? []));
  const rows = await db().update(notifications).set({ readAt: new Date() }).where(and(...filters)).returning({ id: notifications.id });
  return { updated: rows.length };
}
