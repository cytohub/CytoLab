import 'server-only';
import { z } from 'zod';

const boolFlag = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ error: 'DATABASE_URL must be a postgres:// connection URL' }),
  APP_URL: z.url().default('http://localhost:3000'),
  DEMO_MODE: boolFlag,
  STORAGE_DIR: z.string().min(1).default('.data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  INTERNAL_JOB_SECRET: z.string().min(16).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.output<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated environment, parsed on first use (not at import time) so builds and
 * tooling that never touch the database do not require runtime secrets.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests that change process.env between suites. */
export function resetEnvCache(): void {
  cached = undefined;
}
