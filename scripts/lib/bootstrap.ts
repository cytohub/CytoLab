import { config } from 'dotenv';

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

export function assertNotProduction(action: string): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE !== 'true') {
    console.error(`✖ Refusing to ${action} with NODE_ENV=production (set ALLOW_DESTRUCTIVE=true to override).`);
    process.exit(1);
  }
}
