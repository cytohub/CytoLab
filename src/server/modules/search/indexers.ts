import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../db/client';

/**
 * Indexers pull from the source of truth and upsert search documents with
 * set-based SQL, so indexing one record (inside a write transaction) and
 * re-indexing a whole organization share the same code path.
 */

const UPSERT_TAIL = sql`
  on conflict (org_id, object_type, object_id) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    keywords = excluded.keywords,
    body = excluded.body,
    project_id = excluded.project_id,
    updated_at = now()`;

function idFilter(column: SQL, ids?: readonly string[]): SQL {
  if (!ids) return sql``;
  if (ids.length === 0) return sql`and false`;
  return sql`and ${column} in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

async function removeDeleted(tx: Executor, objectType: string, table: SQL, orgId: string, ids?: readonly string[]) {
  await tx.execute(sql`
    delete from search_documents d
    using ${table} t
    where d.org_id = ${orgId} and d.object_type = ${objectType}
      and d.object_id = t.id and t.deleted_at is not null
      ${idFilter(sql`t.id`, ids)}`);
}

export async function indexProjects(tx: Executor, orgId: string, ids?: readonly string[]): Promise<void> {
  await tx.execute(sql`
    insert into search_documents (org_id, object_type, object_id, title, subtitle, keywords, body, project_id)
    select p.org_id, 'project', p.id, p.name,
           concat_ws(' · ', p.code, ra.name),
           p.code,
           concat_ws(' ', p.description, t.name, u.name),
           p.id
    from projects p
    left join research_areas ra on ra.id = p.research_area_id
    left join teams t on t.id = p.team_id
    join users u on u.id = p.owner_id
    where p.org_id = ${orgId} and p.deleted_at is null ${idFilter(sql`p.id`, ids)}
    ${UPSERT_TAIL}`);
  await removeDeleted(tx, 'project', sql`projects`, orgId, ids);
}

export async function indexExperiments(tx: Executor, orgId: string, ids?: readonly string[]): Promise<void> {
  await tx.execute(sql`
    insert into search_documents (org_id, object_type, object_id, title, subtitle, keywords, body, project_id)
    select e.org_id, 'experiment', e.id, e.name,
           concat_ws(' · ', e.display_id, p.code, et.name),
           concat_ws(' ', e.display_id, e.protocol_ref),
           concat_ws(' ', e.objective, e.hypothesis, e.results_summary, e.conclusion, u.name,
             (select string_agg(tg.name, ' ') from entity_tags etg join tags tg on tg.id = etg.tag_id where etg.entity_id = e.id)),
           e.project_id
    from experiments e
    join projects p on p.id = e.project_id
    join experiment_types et on et.id = e.experiment_type_id
    join users u on u.id = e.researcher_id
    where e.org_id = ${orgId} and e.deleted_at is null ${idFilter(sql`e.id`, ids)}
    ${UPSERT_TAIL}`);
  await removeDeleted(tx, 'experiment', sql`experiments`, orgId, ids);
}

export async function indexUsers(tx: Executor, orgId: string, ids?: readonly string[]): Promise<void> {
  await tx.execute(sql`
    insert into search_documents (org_id, object_type, object_id, title, subtitle, keywords, body, project_id)
    select m.org_id, 'user', u.id, u.name,
           concat_ws(' · ', u.title, u.email),
           u.email,
           (select string_agg(t.name, ' ') from team_memberships tm join teams t on t.id = tm.team_id
             where tm.user_id = u.id and tm.org_id = m.org_id and t.deleted_at is null),
           null
    from org_memberships m
    join users u on u.id = m.user_id
    where m.org_id = ${orgId} and m.status = 'active' ${idFilter(sql`u.id`, ids)}
    ${UPSERT_TAIL}`);
  // Members who left or were suspended disappear from search.
  await tx.execute(sql`
    delete from search_documents d
    using org_memberships m
    where d.org_id = ${orgId} and d.object_type = 'user' and m.org_id = d.org_id
      and m.user_id = d.object_id and m.status <> 'active'
      ${idFilter(sql`m.user_id`, ids)}`);
}

export async function reindexOrganization(tx: Executor, orgId: string): Promise<void> {
  await indexProjects(tx, orgId);
  await indexExperiments(tx, orgId);
  await indexUsers(tx, orgId);
}
