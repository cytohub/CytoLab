import { assertNotProduction, requireEnv, run } from './lib/bootstrap';
import { dropAllObjects, runMigrations } from '../src/server/db/maintenance';

/** Drops and recreates the development database schema, then seeds demo data. */
run(async () => {
  assertNotProduction('reset the database');
  const url = requireEnv('DATABASE_URL');
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
