import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries: the pool or an open transaction. */
export type Executor = Database | Transaction;

interface DbGlobals {
  __cytolabSql?: postgres.Sql;
  __cytolabDb?: Database;
}
// Survive dev-server hot reloads without leaking connection pools.
const globals = globalThis as unknown as DbGlobals;

export function db(): Database {
  if (globals.__cytolabDb) return globals.__cytolabDb;
  const sql = postgres(env().DATABASE_URL, {
    max: env().NODE_ENV === 'test' ? 4 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  globals.__cytolabSql = sql;
  globals.__cytolabDb = drizzle(sql, { schema });
  return globals.__cytolabDb;
}

export async function closeDb(): Promise<void> {
  const sql = globals.__cytolabSql;
  globals.__cytolabSql = undefined;
  globals.__cytolabDb = undefined;
  await sql?.end({ timeout: 5 });
}

export { schema };
