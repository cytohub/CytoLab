import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { ok, publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness + database connectivity probe. */
export const GET = publicApi(async () => {
  let database = 'ok';
  try {
    await db().execute(sql`select 1`);
  } catch {
    database = 'unavailable';
  }
  return ok({ status: database === 'ok' ? 'healthy' : 'degraded', database, time: new Date().toISOString() });
});
