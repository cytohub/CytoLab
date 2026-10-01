import { requireEnv, run } from './lib/bootstrap';
import { ownerDatabaseUrl } from './lib/database-urls';
import { grantAppRole } from '../src/server/db/maintenance';

/** Re-applies the app role's privileges (db:migrate and db:reset do this already). */
run(async () => {
  const role = requireEnv('APP_DB_ROLE');
  await grantAppRole(ownerDatabaseUrl(), role);
  console.log(`✔ Granted row access to ${role}`);
});
