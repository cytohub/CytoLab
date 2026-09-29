import { type SQL, sql } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { tsvector, updatedAt } from './_shared';
import { organizations } from './identity';

/**
 * Denormalized search index, keyed per organization (a user who belongs to two
 * organizations has one document in each). Indexers map source rows to documents;
 * the search service ranks all object types with one query.
 *
 * The vector combines an unstemmed ('simple') copy of identifiers and titles for
 * prefix matching with a stemmed ('english') copy for natural-language matching.
 */
export const searchDocuments = pgTable(
  'search_documents',
  {
    objectType: text('object_type').notNull(),
    objectId: uuid('object_id').notNull(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    /** Identifiers and short codes (display IDs, emails) matched by prefix/trigram. */
    keywords: text('keywords'),
    body: text('body'),
    projectId: uuid('project_id'),
    tsv: tsvector('tsv').generatedAlwaysAs(
      (): SQL => sql`
        setweight(to_tsvector('simple', coalesce(${searchDocuments.keywords}, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(${searchDocuments.title}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${searchDocuments.title}, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(${searchDocuments.subtitle}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${searchDocuments.body}, '')), 'C')`,
    ),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.objectType, t.objectId] }),
    index('search_documents_tsv_idx').using('gin', t.tsv),
    index('search_documents_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
    index('search_documents_keywords_trgm_idx').using('gin', t.keywords.op('gin_trgm_ops')),
  ],
);
