import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../env';
import { clientIp } from './request';

describe('clientIp', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/unit');
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('uses the first X-Forwarded-For hop when no proxy header is configured', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.10' }))).toBe('203.0.113.10');
    expect(clientIp(new Headers())).toBeNull();
  });

  it('trusts only the configured proxy header, so clients cannot pick their address', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'X-Real-IP');
    resetEnvCache();
    const spoofed = new Headers({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '198.51.100.4' });
    expect(clientIp(spoofed)).toBe('198.51.100.4');
    expect(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6' }))).toBeNull();
  });

  it('bounds oversized header values', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': 'x'.repeat(5000) }))).toHaveLength(64);
  });
});
