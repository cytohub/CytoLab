import { describe, expect, it } from 'vitest';
import { ipBucket, normalizeIp } from './client-ip';
import { RateLimiter } from './rate-limit';

describe('ipBucket', () => {
  it('groups an IPv6 /64 so rotating addresses inside it share one limit', () => {
    const a = ipBucket(normalizeIp('2001:db8:1:2::1'));
    const b = ipBucket(normalizeIp('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(a).toBe(b);
    expect(a).toBe('2001:db8:1:2::/64');
    expect(ipBucket(normalizeIp('2001:db8:1:3::1'))).not.toBe(a);
  });

  it('keeps IPv4 addresses whole and buckets unknown ones together', () => {
    expect(ipBucket(normalizeIp('198.51.100.1'))).toBe('198.51.100.1');
    expect(ipBucket(null)).toBe('unknown');
  });

  it('expands embedded IPv4 notation', () => {
    expect(normalizeIp('64:ff9b::192.0.2.33')).toBe('64:ff9b:0:0:0:0:c000:221');
  });
});

describe('RateLimiter', () => {
  it('keeps at most maxKeys entries, dropping the oldest', () => {
    const limiter = new RateLimiter(5, 60_000, undefined, 100);
    for (let i = 0; i < 1_000; i++) limiter.consume(`key-${i}`, 1_000);
    expect(limiter.size).toBe(100);
  });

  it('still limits a key that keeps coming back', () => {
    const limiter = new RateLimiter(2, 60_000, undefined, 100);
    limiter.consume('k', 0);
    limiter.consume('k', 1);
    expect(() => limiter.consume('k', 2)).toThrow();
  });
});
