import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import postgres from 'postgres';

/**
 * Schema maintenance used by CLI scripts and the integration-test harness.
 * Deliberately independent of the app's pooled client so it can target any URL.
 */

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'drizzle');

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const ROLE_NAME_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Gives the role the app runs as exactly what it needs: read and write rows,
 * never change the schema. The audit log is insert-only for it, and since it
 * owns no table it cannot drop the append-only trigger either, so neither an
 * app bug nor injected SQL can rewrite history.
 *
 * Run as the schema owner after every migration and reset: a reset recreates
 * the schema, which discards the grants.
 */
export async function grantAppRole(databaseUrl: string, role: string): Promise<void> {
  if (!ROLE_NAME_RE.test(role)) throw new Error('APP_DB_ROLE must be a lower-case identifier, e.g. cytolab_app');
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const [exists] = await sql<{ exists: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${role}) AS exists`;
    if (!exists?.exists) throw new Error(`Role "${role}" does not exist; create it first (see DEPLOY.md)`);
    const quoted = `"${role}"`;
    await sql.unsafe(`
      GRANT USAGE ON SCHEMA public TO ${quoted};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoted};
      GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${quoted};
      REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ${quoted};
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Organizations not flagged as demo workspaces (0 for a database with no schema yet). */
export async function countNonDemoOrganizations(databaseUrl: string): Promise<number> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const [table] = await sql<{ exists: boolean }[]>`SELECT to_regclass('public.organizations') IS NOT NULL AS exists`;
    if (!table?.exists) return 0;
    const [row] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM organizations WHERE NOT is_demo`;
    return row?.count ?? 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Drops every application object (including the append-only audit log, which
 * cannot be truncated) by recreating the schemas. Development, test, and the
 * nightly reset of a public demo (guarded in scripts/lib/bootstrap.ts).
 */
export async function dropAllObjects(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
