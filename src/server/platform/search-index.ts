import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import type { SearchObjectType } from '@/domain/enums';
import { entityHref } from '@/lib/routes';
import type { AuthContext } from '../auth/context';
import { db, type Executor } from '../db/client';
import { searchDocuments } from '../db/schema';
import { escapeLike } from '../db/sql-utils';

export interface SearchDocumentInput {
  objectType: SearchObjectType;
  objectId: string;
  orgId: string;
  title: string;
  subtitle?: string | null;
  keywords?: string | null;
  body?: string | null;
  projectId?: string | null;
}

export async function upsertSearchDocument(tx: Executor, doc: SearchDocumentInput): Promise<void> {
  const values = {
    objectType: doc.objectType,
    objectId: doc.objectId,
    orgId: doc.orgId,
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    keywords: doc.keywords ?? null,
    body: doc.body ?? null,
    projectId: doc.projectId ?? null,
    updatedAt: new Date(),
  };
  await tx
    .insert(searchDocuments)
    .values(values)
    .onConflictDoUpdate({
      target: [searchDocuments.orgId, searchDocuments.objectType, searchDocuments.objectId],
      set: {
        title: values.title,
        subtitle: values.subtitle,
        keywords: values.keywords,
        body: values.body,
        projectId: values.projectId,
        updatedAt: values.updatedAt,
      },
    });
}

export async function removeSearchDocument(tx: Executor, orgId: string, objectType: SearchObjectType, objectId: string) {
  await tx
    .delete(searchDocuments)
    .where(
      and(eq(searchDocuments.orgId, orgId), eq(searchDocuments.objectType, objectType), eq(searchDocuments.objectId, objectId)),
    );
}

export interface SearchHit {
  type: SearchObjectType;
  id: string;
  title: string;
  subtitle: string | null;
  keywords: string | null;
  href: string;
  score: number;
}

/**
 * Builds a prefix tsquery from free text ("car t cell" → "car:* & t:* & cell:*").
 * Only the last fragment of each word is a prefix: in "CAR-T" the hyphen shows
 * "car" is already complete, so it must not match "cardiac", while "t" may still
 * be mid-word ("CAR-T" → "car & t:*"). Space-separated words each stay prefixes,
 * so "lenti trans" still finds "lentiviral transduction". Fragments are letters
 * and digits only, so no tsquery operator can reach the query.
 */
export function toPrefixQuery(q: string): string | null {
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .flatMap((word) => {
      const fragments = word.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      return fragments.map((fragment, i) => (i === fragments.length - 1 ? `${fragment}:*` : fragment));
    })
    .slice(0, 8);
  return terms.length ? terms.join(' & ') : null;
}

/**
 * One ranked query across all object types: prefix and stemmed full-text matches,
 * trigram similarity for typos, and a strong boost for exact identifier matches.
 * Results are capped per type so each group in the UI gets its best hits.
 */
export async function searchDocumentsFor(
  ctx: AuthContext,
  params: { q: string; types?: readonly SearchObjectType[]; limitPerType: number },
): Promise<SearchHit[]> {
  const q = params.q.trim();
  const prefix = toPrefixQuery(q);
  const like = `${escapeLike(q)}%`;
  const typeFilter = params.types?.length
    ? sql`and d.object_type in (${sql.join(params.types.map((t) => sql`${t}`), sql`, `)})`
    : sql``;
  const prefixQuery = prefix ? sql`to_tsquery('simple', ${prefix})` : sql`null::tsquery`;

  const rows = await db().execute<{
    object_type: SearchObjectType;
    object_id: string;
    title: string;
    subtitle: string | null;
    keywords: string | null;
    ref: string | null;
    score: number;
  }>(sql`
    with q as (
      select ${prefixQuery} as pq, websearch_to_tsquery('english', ${q}) as wq
    ),
    matches as (
      select
        d.object_type, d.object_id, d.title, d.subtitle, d.keywords,
        (
          coalesce(ts_rank_cd(d.tsv, q.pq), 0) * 2
          + coalesce(ts_rank(d.tsv, q.wq), 0)
          + similarity(d.title, ${q})
          + case when d.keywords ilike ${escapeLike(q)} then 4 when d.keywords ilike ${like} then 1.5 else 0 end
          + case when d.title ilike ${like} then 0.5 else 0 end
        )::float8 as score
      from search_documents d, q
      where d.org_id = ${ctx.orgId}
        ${typeFilter}
        and (
          (q.pq is not null and d.tsv @@ q.pq)
          or d.tsv @@ q.wq
          or d.title % ${q}
          or d.keywords ilike ${like}
          or d.keywords ilike ${`%${escapeLike(q)}%`}
        )
    ),
    ranked as (
      select *, row_number() over (partition by object_type order by score desc, title asc) as rn
      from matches
    )
    select r.object_type, r.object_id, r.title, r.subtitle, r.keywords, r.score,
           coalesce(e.display_id, r.object_id::text) as ref
    from ranked r
    left join entities e on e.id = r.object_id
    where r.rn <= ${params.limitPerType}
    order by r.score desc
  `);

  return rows.map((r) => ({
    type: r.object_type,
    id: r.object_id,
    title: r.title,
    subtitle: r.subtitle,
    keywords: r.keywords,
    score: Number(r.score),
    href: entityHref(r.object_type, r.object_type === 'user' ? r.object_id : (r.ref ?? r.object_id)),
  }));
}
