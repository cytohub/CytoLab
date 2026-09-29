import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { actorTypeEnum, createdAt, notificationTypeEnum, primaryId, timestamptz } from './_shared';
import { entities } from './entities';
import { organizations, users } from './identity';
import { projects } from './research';

/**
 * Human-meaningful activity feed. `payload` is JSONB because event details are
 * heterogeneous and never filtered on; everything queried is a typed column.
 */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
    actorId: uuid('actor_id').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('user'),
    /** Namespaced verb, e.g. `experiment.status_changed`. */
    action: text('action').notNull(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('activity_org_time_idx').on(t.orgId, t.occurredAt.desc(), t.id.desc()),
    index('activity_entity_time_idx').on(t.entityId, t.occurredAt.desc()),
    index('activity_project_time_idx').on(t.projectId, t.occurredAt.desc()),
    index('activity_actor_time_idx').on(t.actorId, t.occurredAt.desc()),
  ],
);

/**
 * Compliance audit trail: every mutation with field-level changes. Append-only —
 * a trigger (migration 0002) rejects UPDATE, DELETE and TRUNCATE.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: primaryId(),
    orgId: uuid('org_id').references(() => organizations.id),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
    actorId: uuid('actor_id').references(() => users.id),
    actorType: actorTypeEnum('actor_type').notNull().default('user'),
    /** create | update | delete | restore | login | … */
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    changes: jsonb('changes').$type<Record<string, { from: unknown; to: unknown }>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('audit_org_time_idx').on(t.orgId, t.occurredAt.desc()),
    index('audit_resource_idx').on(t.resourceType, t.resourceId, t.occurredAt.desc()),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id),
    type: notificationTypeEnum('type').notNull(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id),
    activityEventId: uuid('activity_event_id').references(() => activityEvents.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body'),
    readAt: timestamptz('read_at'),
    /** Makes job-generated alerts idempotent (one per recipient per condition). */
    dedupeKey: text('dedupe_key'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_recipient_time_idx').on(t.recipientId, t.createdAt.desc()),
    index('notifications_recipient_unread_idx').on(t.recipientId).where(sql`${t.readAt} is null`),
    uniqueIndex('notifications_dedupe_unique')
      .on(t.recipientId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);
