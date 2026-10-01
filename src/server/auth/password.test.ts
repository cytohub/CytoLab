import { describe, expect, it } from 'vitest';
import { RateLimitError } from '@/domain/errors';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
  });

  it('refuses work once the queue is full instead of piling up scrypt calls', async () => {
    const stored = await hashPassword('x');
    const results = await Promise.allSettled(Array.from({ length: 60 }, () => verifyPassword('y', stored)));
    const refused = results.filter((r) => r.status === 'rejected');
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((r) => (r as PromiseRejectedResult).reason instanceof RateLimitError)).toBe(true);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(52); // 2 running + 50 queued
  }, 30_000);
});
