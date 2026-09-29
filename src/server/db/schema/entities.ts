import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, entityTypeEnum, linkTypeEnum, primaryId } from './_shared';
import { organizations, users } from './identity';

/**
 * Entity registry: one row per first-class scientific object, sharing the object's
 * UUID. Generic capabilities (comments, attachments, tags, links, activity) reference
 * this table with real foreign keys, so they work for every current and future type.
 */
export const entities = pgTable(
  'entities',
  {
    /** Same UUID as the typed row (projects.id, experiments.id, …). */
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    entityType: entityTypeEnum('entity_type').notNull(),
    /** Denormalized for rendering references without joining typed tables. */
    displayId: text('display_id').notNull(),
    title: text('title').notNull(),
    createdAt: createdAt(),
    createdBy: uuid('created_by').references(() => users.id),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('entities_org_display_id_unique')
      .on(t.orgId, sql`upper(${t.displayId})`)
      .where(sql`${t.deletedAt} is null`),
    index('entities_org_type_idx').on(t.orgId, t.entityType),
  ],
);

/** Per-org counters for human-readable IDs (EXP-1024, SMP-00042, milestone M3). */
export const idSequences = pgTable(
  'id_sequences',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    scope: text('scope').notNull(),
    lastValue: integer('last_value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.scope] })],
);

export const tags = pgTable(
  'tags',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    color: text('color').notNull().default('slate'),
    createdAt: createdAt(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => [uniqueIndex('tags_org_name_unique').on(t.orgId, sql`lower(${t.name})`)],
);

export const entityTags = pgTable(
  'entity_tags',
  {
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    createdAt: createdAt(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.entityId, t.tagId] }), index('entity_tags_tag_idx').on(t.tagId)],
);

/** Typed edges between any two entities: the generic part of the knowledge graph. */
export const entityLinks = pgTable(
  'entity_links',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    linkType: linkTypeEnum('link_type').notNull().default('related_to'),
    createdAt: createdAt(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('entity_links_unique').on(t.sourceId, t.targetId, t.linkType),
    index('entity_links_target_idx').on(t.targetId),
    check('entity_links_no_self_link', sql`${t.sourceId} <> ${t.targetId}`),
  ],
);
