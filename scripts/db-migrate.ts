import { requireEnv, run } from './lib/bootstrap';
import { runMigrations } from '../src/server/db/maintenance';

run(async () => {
  const url = process.argv.includes('--test') ? requireEnv('DATABASE_URL_TEST') : requireEnv('DATABASE_URL');
  await runMigrations(url);
  console.log('✔ Migrations applied');
});
