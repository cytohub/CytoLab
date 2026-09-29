import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { EntityType } from '@/domain/enums';
import { NotFoundError } from '@/domain/errors';
import { entityHref } from '@/lib/routes';
import type { AuthContext } from '../auth/context';
import { db, type Executor } from '../db/client';
import { entities } from '../db/schema';

/** A renderable reference to any first-class object. */
export interface EntityRef {
  id: string;
  type: EntityType;
  displayId: string;
  title: string;
  href: string;
  deleted: boolean;
}

export async function registerEntity(
  tx: Executor,
  input: { id: string; orgId: string; entityType: EntityType; displayId: string; title: string; createdBy: string | null; createdAt?: Date },
): Promise<void> {
  await tx.insert(entities).values(input);
}

/** Keeps the registry's denormalized label in sync when the typed row is renamed. */
export async function syncEntityLabel(tx: Executor, id: string, label: { displayId?: string; title?: string }): Promise<void> {
  if (label.displayId === undefined && label.title === undefined) return;
  await tx.update(entities).set(label).where(eq(entities.id, id));
}

export async function setEntityDeleted(tx: Executor, id: string, deletedAt: Date | null): Promise<void> {
  await tx.update(entities).set({ deletedAt }).where(eq(entities.id, id));
}

function toRef(row: { id: string; entityType: EntityType; displayId: string; title: string; deletedAt: Date | null }): EntityRef {
  return {
    id: row.id,
    type: row.entityType,
    displayId: row.displayId,
    title: row.title,
    href: entityHref(row.entityType, row.displayId),
    deleted: row.deletedAt !== null,
  };
}

const refColumns = {
  id: entities.id,
  entityType: entities.entityType,
  displayId: entities.displayId,
  title: entities.title,
  deletedAt: entities.deletedAt,
};

/** Loads an entity in the caller's organization or throws 404 (never leaks other tenants). */
export async function getEntityRef(ctx: AuthContext, id: string, { includeDeleted = false } = {}): Promise<EntityRef> {
  const [row] = await db()
    .select(refColumns)
    .from(entities)
    .where(and(eq(entities.id, id), eq(entities.orgId, ctx.orgId), includeDeleted ? undefined : isNull(entities.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('Record');
  return toRef(row);
}

export async function resolveDisplayId(ctx: AuthContext, displayId: string): Promise<EntityRef> {
  const [row] = await db()
    .select(refColumns)
    .from(entities)
    .where(
      and(eq(entities.orgId, ctx.orgId), sql`upper(${entities.displayId}) = upper(${displayId})`, isNull(entities.deletedAt)),
    )
    .limit(1);
  if (!row) throw new NotFoundError('Record');
  return toRef(row);
}

export async function getEntityRefs(ctx: AuthContext, ids: readonly string[]): Promise<Map<string, EntityRef>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db()
    .select(refColumns)
    .from(entities)
    .where(and(eq(entities.orgId, ctx.orgId), inArray(entities.id, unique)));
  return new Map(rows.map((r) => [r.id, toRef(r)]));
}
