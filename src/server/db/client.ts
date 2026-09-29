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
  __bioengineSql?: postgres.Sql;
  __bioengineDb?: Database;
}
// Survive dev-server hot reloads without leaking connection pools.
const globals = globalThis as unknown as DbGlobals;

export function db(): Database {
  if (globals.__bioengineDb) return globals.__bioengineDb;
  const sql = postgres(env().DATABASE_URL, {
    max: env().NODE_ENV === 'test' ? 4 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  globals.__bioengineSql = sql;
  globals.__bioengineDb = drizzle(sql, { schema });
  return globals.__bioengineDb;
}

export async function closeDb(): Promise<void> {
  const sql = globals.__bioengineSql;
  globals.__bioengineSql = undefined;
  globals.__bioengineDb = undefined;
  await sql?.end({ timeout: 5 });
}

export { schema };
