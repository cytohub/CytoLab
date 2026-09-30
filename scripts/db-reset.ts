import { assertDisposableDatabase, requireEnv, run } from './lib/bootstrap';
import { dropAllObjects, runMigrations } from '../src/server/db/maintenance';

/**
 * Drops and recreates the database schema, then seeds demo data. Used in
 * development and, on a schedule, to return a public demo to its seeded state.
 */
run(async () => {
  const url = requireEnv('DATABASE_URL');
  await assertDisposableDatabase('reset the database', url);
  await dropAllObjects(url);
  console.log('✔ Dropped schema');
  await runMigrations(url);
  console.log('✔ Migrations applied');

  if (!process.argv.includes('--no-seed')) {
    const { seedDemoData } = await import('./seed/seed');
    const summary = await seedDemoData();
    console.log(`✔ Seeded demo workspace: ${summary}`);
  }
});
