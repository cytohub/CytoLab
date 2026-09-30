import { config } from 'dotenv';
import { countNonDemoOrganizations } from '../../src/server/db/maintenance';

config({ quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`✖ ${name} is not set. Copy .env.example to .env and adjust it.`);
    process.exit(1);
  }
  return value;
}

export function run(main: () => Promise<void>): void {
  main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('✖', err instanceof Error ? (err.stack ?? err.message) : err);
      process.exit(1);
    });
}

function refuse(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/**
 * Guards scripts that wipe data or create the demo accounts (whose password is
 * public). Outside production they always run. In production they run only on a
 * public demo (PUBLIC_DEMO=true), whose data is disposable by definition, and
 * only while the database holds nothing but demo workspaces, so a flag set by
 * mistake on a real deployment cannot destroy real records.
 * ALLOW_DESTRUCTIVE=true overrides both checks.
 */
export async function assertDisposableDatabase(action: string, databaseUrl: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DESTRUCTIVE === 'true') return;

  const publicDemo = process.env.PUBLIC_DEMO === 'true' || process.env.PUBLIC_DEMO === '1';
  if (!publicDemo) {
    refuse(`Refusing to ${action} with NODE_ENV=production unless PUBLIC_DEMO=true (or ALLOW_DESTRUCTIVE=true).`);
  }
  const realOrganizations = await countNonDemoOrganizations(databaseUrl);
  if (realOrganizations > 0) {
    refuse(`Refusing to ${action}: the database holds ${realOrganizations} non-demo organization(s).`);
  }
}
