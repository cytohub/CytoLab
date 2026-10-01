import { assertDisposableDatabase, run } from './lib/bootstrap';
import { appDatabaseRole, ownerDatabaseUrl } from './lib/database-urls';
import { dropAllObjects, grantAppRole, runMigrations } from '../src/server/db/maintenance';

/**
 * Drops and recreates the database schema, then seeds demo data. Used in
 * development and, on a schedule, to return a public demo to its seeded state.
 */
run(async () => {
  const url = ownerDatabaseUrl();
  await assertDisposableDatabase('reset the database', url);
  await dropAllObjects(url);
  console.log('✔ Dropped schema');
  await runMigrations(url);
  console.log('✔ Migrations applied');
  // Recreating the schema discarded the runtime role's grants.
  const role = appDatabaseRole();
  if (role) {
    await grantAppRole(url, role);
    console.log(`✔ Granted row access to ${role}`);
  }

  if (!process.argv.includes('--no-seed')) {
    const { seedDemoData } = await import('./seed/seed');
    const summary = await seedDemoData();
    console.log(`✔ Seeded demo workspace: ${summary}`);
  }
});
