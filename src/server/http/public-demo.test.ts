import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, RateLimitError } from '@/domain/errors';
import { PUBLIC_DEMO_LOCKS, PUBLIC_DEMO_WRITE_LIMIT } from '@/domain/public-demo';
import { resetEnvCache } from '../env';
import { demoWriteLimiter, enforcePublicDemoWrite, publicDemoLockReason } from './public-demo';

const visitor = (ip: string) => new Headers({ 'x-forwarded-for': ip });

describe('public demo guardrails', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/unit');
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('does nothing unless PUBLIC_DEMO is on', () => {
    expect(() => enforcePublicDemoWrite(visitor('192.0.2.1'), 'files')).not.toThrow();
    expect(publicDemoLockReason('people')).toBeNull();
  });

  it('refuses locked areas with the reason shown in the UI', () => {
    vi.stubEnv('PUBLIC_DEMO', 'true');
    resetEnvCache();
    expect(() => enforcePublicDemoWrite(visitor('192.0.2.2'), 'files')).toThrow(new ForbiddenError(PUBLIC_DEMO_LOCKS.files));
    expect(() => enforcePublicDemoWrite(visitor('192.0.2.2'), 'people')).toThrow(PUBLIC_DEMO_LOCKS.people);
    expect(publicDemoLockReason('files')).toBe(PUBLIC_DEMO_LOCKS.files);
  });

  it('limits each visitor’s writes without affecting other visitors', () => {
    vi.stubEnv('PUBLIC_DEMO', 'true');
    resetEnvCache();
    try {
      for (let i = 0; i < PUBLIC_DEMO_WRITE_LIMIT.limit; i++) enforcePublicDemoWrite(visitor('192.0.2.3'), undefined);
      expect(() => enforcePublicDemoWrite(visitor('192.0.2.3'), undefined)).toThrow(RateLimitError);
      expect(() => enforcePublicDemoWrite(visitor('192.0.2.3'), undefined)).toThrow(/public demo/);
      expect(() => enforcePublicDemoWrite(visitor('192.0.2.4'), undefined)).not.toThrow();
    } finally {
      demoWriteLimiter.reset('192.0.2.3');
      demoWriteLimiter.reset('192.0.2.4');
    }
  });
});
