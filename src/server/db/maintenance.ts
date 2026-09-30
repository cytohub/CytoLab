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
