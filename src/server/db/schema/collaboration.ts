import { sql } from 'drizzle-orm';
import { type AnyPgColumn, bigint, check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, primaryId, timestamptz, updatedAt } from './_shared';
import { entities } from './entities';
import { organizations, users } from './identity';

export const comments = pgTable(
  'comments',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    editedAt: timestamptz('edited_at'),
    deletedAt: deletedAt(),
  },
  (t) => [index('comments_entity_idx').on(t.entityId, t.createdAt)],
);

export const attachments = pgTable(
  'attachments',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    /** Opaque, server-generated key. Never derived from user input. */
    storageKey: text('storage_key').notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    description: text('description'),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('attachments_storage_key_unique').on(t.storageKey),
    index('attachments_entity_idx').on(t.entityId, t.createdAt),
    check('attachments_size_nonnegative', sql`${t.sizeBytes} >= 0`),
  ],
);
