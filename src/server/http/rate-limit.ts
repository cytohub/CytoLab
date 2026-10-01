import 'server-only';
import { RateLimitError } from '@/domain/errors';

/**
 * Fixed-window, in-process limiter. Adequate for a single V1 instance; swap for a
 * shared store (Redis) when the app runs on more than one node.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastPrune = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly message?: string,
    /** Keys kept at most; past it the oldest are dropped, so a flood of distinct keys cannot grow memory without bound. */
    private readonly maxKeys = 20_000,
  ) {}

  consume(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.delete(key); // re-insert at the end, keeping the map in age order
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) throw new RateLimitError(Math.ceil((entry.resetAt - now) / 1000), this.message);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  get size(): number {
    return this.hits.size;
  }

  private prune(now: number) {
    if (now - this.lastPrune > 1_000) {
      this.lastPrune = now;
      for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    }
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** 10 sign-in attempts per 15 minutes per address and account. */
export const loginLimiter = new RateLimiter(10, FIFTEEN_MINUTES);
/** 30 attempts per 15 minutes per account from any address, which caps distributed guessing. */
export const loginAccountLimiter = new RateLimiter(30, FIFTEEN_MINUTES, 'Too many sign-in attempts for this account. Try again later.');
/** 60 attempts per 15 minutes per address across accounts, which caps password spraying. */
export const loginAddressLimiter = new RateLimiter(60, FIFTEEN_MINUTES);
