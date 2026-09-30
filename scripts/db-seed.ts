import { assertDisposableDatabase, requireEnv, run } from './lib/bootstrap';

run(async () => {
  const url = requireEnv('DATABASE_URL');
  await assertDisposableDatabase('seed demo data', url);
  const { seedDemoData } = await import('./seed/seed');
  const summary = await seedDemoData({ force: process.argv.includes('--force') });
  console.log(`✔ Seeded demo workspace: ${summary}`);
});
