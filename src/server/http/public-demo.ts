import 'server-only';
import { ForbiddenError } from '@/domain/errors';
import { PUBLIC_DEMO_LOCKS, PUBLIC_DEMO_WRITE_LIMIT, type PublicDemoLock } from '@/domain/public-demo';
import { clientIp } from '../auth/request';
import { env } from '../env';
import { ipBucket } from './client-ip';
import { RateLimiter } from './rate-limit';

export const demoWriteLimiter = new RateLimiter(
  PUBLIC_DEMO_WRITE_LIMIT.limit,
  PUBLIC_DEMO_WRITE_LIMIT.windowMs,
  'You are making changes faster than the public demo allows. Try again in a few minutes.',
);

/**
 * Applies the public-demo guardrails to an authenticated write. A no-op unless
 * PUBLIC_DEMO is on. Locked handlers are refused before their body is read;
 * every other write counts toward the visitor's limit.
 */
export function enforcePublicDemoWrite(headers: Headers, lock: PublicDemoLock | undefined): void {
  if (!env().PUBLIC_DEMO) return;
  if (lock) throw new ForbiddenError(PUBLIC_DEMO_LOCKS[lock]);
  demoWriteLimiter.consume(ipBucket(clientIp(headers)));
}

/** The lock message to show in the UI, or null when the area is writable. */
export function publicDemoLockReason(lock: PublicDemoLock): string | null {
  return env().PUBLIC_DEMO ? PUBLIC_DEMO_LOCKS[lock] : null;
}
