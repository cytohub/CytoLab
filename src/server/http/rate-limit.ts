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
    /** Keys kept at most, so a flood of distinct keys cannot grow memory without bound. */
    private readonly maxKeys = 20_000,
  ) {}

  consume(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.delete(key); // re-insert at the end, keeping the map in age order
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now, key);
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

  /**
   * Drops expired entries, then, while over the cap, the entry with the fewest
   * hits (the oldest among equals). Evicting by age alone would let a flood of
   * junk keys push out a counter someone is guessing against and start it over;
   * by count, the flood has to out-hit that counter first. The key just added
   * is never the one dropped, or a full map would stop counting it at all.
   */
  private prune(now: number, added: string) {
    if (now - this.lastPrune > 1_000) {
      this.lastPrune = now;
      for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    }
    while (this.hits.size > this.maxKeys) {
      let victim: string | undefined;
      let fewest = Infinity;
      for (const [key, entry] of this.hits) {
        if (key !== added && entry.count < fewest) {
          victim = key;
          fewest = entry.count;
          if (fewest === 1) break; // the oldest single hit; nothing has fewer
        }
      }
      if (victim === undefined) break;
      this.hits.delete(victim);
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
