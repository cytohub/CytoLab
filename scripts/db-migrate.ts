import { requireEnv, run } from './lib/bootstrap';
import { appDatabaseRole, ownerDatabaseUrl } from './lib/database-urls';
import { grantAppRole, runMigrations } from '../src/server/db/maintenance';

run(async () => {
  const test = process.argv.includes('--test');
  const url = test ? requireEnv('DATABASE_URL_TEST') : ownerDatabaseUrl();
  await runMigrations(url);
  console.log('✔ Migrations applied');

  const role = test ? undefined : appDatabaseRole();
  if (role) {
    await grantAppRole(url, role);
    console.log(`✔ Granted row access to ${role}`);
  }
});
