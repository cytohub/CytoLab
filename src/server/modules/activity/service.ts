import 'server-only';
import { and, desc, eq, lt, or, sql, type SQL } from 'drizzle-orm';
import type { ActorType } from '@/domain/enums';
import type { ActivityQuery } from '@/domain/schemas/platform';
import { entityHref } from '@/lib/routes';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { activityEvents, entities, users } from '../../db/schema';
import { decodeCursor, encodeCursor } from '../shared/pagination';
import { initialsOf } from '../shared/presenters';

export interface ActivityItem {
  id: string;
  action: string;
  occurredAt: string;
  actor: { id: string; name: string; initials: string; avatarColor: string; avatarUrl: string | null } | null;
  actorType: ActorType;
  entity: { id: string; type: string; displayId: string; title: string; href: string; deleted: boolean } | null;
  projectId: string | null;
  payload: Record<string, unknown>;
}

export interface ActivityFeed {
  items: ActivityItem[];
  nextCursor: string | null;
}

export async function listActivity(ctx: AuthContext, query: ActivityQuery): Promise<ActivityFeed> {
  const filters: SQL[] = [eq(activityEvents.orgId, ctx.orgId)];
  if (query.entityId) filters.push(eq(activityEvents.entityId, query.entityId));
  if (query.projectId) filters.push(eq(activityEvents.projectId, query.projectId));
  if (query.actorId) filters.push(eq(activityEvents.actorId, query.actorId));
  if (query.action) filters.push(or(eq(activityEvents.action, query.action), sql`${activityEvents.action} like ${query.action + '.%'}`)!);

  if (query.before) {
    const cursor = decodeCursor(query.before);
    if (cursor) {
      filters.push(
        or(
          lt(activityEvents.occurredAt, cursor.occurredAt),
          and(eq(activityEvents.occurredAt, cursor.occurredAt), lt(activityEvents.id, cursor.id)),
        )!,
      );
    }
  }

  const rows = await db()
    .select({
      id: activityEvents.id,
      action: activityEvents.action,
      occurredAt: activityEvents.occurredAt,
      actorType: activityEvents.actorType,
      payload: activityEvents.payload,
      projectId: activityEvents.projectId,
      actorId: users.id,
      actorName: users.name,
      actorColor: users.avatarColor,
      actorAvatar: users.avatarUrl,
      entityId: entities.id,
      entityType: entities.entityType,
      entityDisplayId: entities.displayId,
      entityTitle: entities.title,
      entityDeleted: entities.deletedAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(users.id, activityEvents.actorId))
    .leftJoin(entities, eq(entities.id, activityEvents.entityId))
    .where(and(...filters))
    .orderBy(desc(activityEvents.occurredAt), desc(activityEvents.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map((row) => ({
      id: row.id,
      action: row.action,
      occurredAt: row.occurredAt.toISOString(),
      actor: row.actorId ? { id: row.actorId, name: row.actorName!, initials: initialsOf(row.actorName!), avatarColor: row.actorColor!, avatarUrl: row.actorAvatar } : null,
      actorType: row.actorType,
      entity: row.entityId
        ? { id: row.entityId, type: row.entityType!, displayId: row.entityDisplayId!, title: row.entityTitle!, href: entityHref(row.entityType!, row.entityDisplayId!), deleted: row.entityDeleted !== null }
        : null,
      projectId: row.projectId,
      payload: row.payload,
    })),
    nextCursor: hasMore && last ? encodeCursor(last.occurredAt, last.id) : null,
  };
}
