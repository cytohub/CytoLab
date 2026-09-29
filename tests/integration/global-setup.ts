import { config } from 'dotenv';
import { dropAllObjects, runMigrations } from '../../src/server/db/maintenance';

config({ quiet: true });

/** Rebuilds the test database schema once before the integration suite runs. */
export default async function setup() {
  const url = process.env.DATABASE_URL_TEST ?? 'postgres://bioengine:bioengine@localhost:5432/bioengine_test';
  await dropAllObjects(url);
  await runMigrations(url);
}
