import 'server-only';
import { RateLimitError } from '@/domain/errors';

/**
 * Fixed-window, in-process limiter. Adequate for a single V1 instance; swap for a
 * shared store (Redis) when the app runs on more than one node.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) throw new RateLimitError(Math.ceil((entry.resetAt - now) / 1000));
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private prune(now: number) {
    if (this.hits.size < 5_000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

/** 10 sign-in attempts per 15 minutes per IP + email. */
export const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);
