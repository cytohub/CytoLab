import { assertNotProduction, requireEnv, run } from './lib/bootstrap';

run(async () => {
  assertNotProduction('seed demo data');
  requireEnv('DATABASE_URL');
  const { seedDemoData } = await import('./seed/seed');
  const summary = await seedDemoData({ force: process.argv.includes('--force') });
  console.log(`✔ Seeded demo workspace: ${summary}`);
});
