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
  // Anyone may sign in: lock uploads and accounts, limit writes, allow nightly resets.
  PUBLIC_DEMO: boolFlag,
  // The one header the reverse proxy overwrites with the client's address
  // (Railway: x-real-ip, Cloudflare: cf-connecting-ip). Unset trusts X-Forwarded-For.
  CLIENT_IP_HEADER: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, { error: 'CLIENT_IP_HEADER must be a header name such as x-real-ip' })
    .optional(),
  // When set, CLIENT_IP_HEADER counts only on requests that also carry
  // `x-client-ip-secret: <this value>`, added by the CDN. Requests that reach
  // the origin directly cannot then claim an address.
  CLIENT_IP_SECRET: z.string().min(16).optional(),
  STORAGE_DIR: z.string().min(1).default('.data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  // The placeholder from .env.example is public, so it disables the endpoint.
  INTERNAL_JOB_SECRET: z
    .string()
    .min(16)
    .optional()
    .transform((v) => (v === 'change-me-to-a-long-random-string' ? undefined : v)),
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
/**
 * Demo workspaces carry accounts with a published password. Outside a declared
 * public demo, production treats them as closed: no listed accounts, no
 * sign-in, no sessions, so seeded demo users left in a real database are inert.
 */
export function demoWorkspacesOpen(): boolean {
  const { NODE_ENV, PUBLIC_DEMO } = env();
  return NODE_ENV !== 'production' || PUBLIC_DEMO;
}

export function resetEnvCache(): void {
  cached = undefined;
}
