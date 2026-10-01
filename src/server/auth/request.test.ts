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

  it('uses the last X-Forwarded-For hop, the one the nearest proxy added, when no header is configured', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
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

  it('believes the CDN header only alongside the shared secret', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'cf-connecting-ip');
    vi.stubEnv('CLIENT_IP_SECRET', 's3cret-from-the-cdn-rule');
    resetEnvCache();
    const viaCdn = new Headers({ 'cf-connecting-ip': '198.51.100.7', 'x-client-ip-secret': 's3cret-from-the-cdn-rule', 'x-forwarded-for': '172.70.1.1' });
    expect(clientIp(viaCdn)).toBe('198.51.100.7');

    // Sent straight to the origin: the claimed address is ignored for the proxy's hop.
    const direct = new Headers({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '1.2.3.4, 203.0.113.50' });
    expect(clientIp(direct)).toBe('203.0.113.50');
    expect(clientIp(new Headers({ ...Object.fromEntries(direct), 'x-client-ip-secret': 'guess' }))).toBe('203.0.113.50');
  });

  it('canonicalizes addresses and drops anything else', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.07' }))).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-forwarded-for': '::ffff:203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-forwarded-for': '2001:DB8::1' }))).toBe('2001:db8:0:0:0:0:0:1');
    expect(clientIp(new Headers({ 'x-forwarded-for': 'x'.repeat(5000) }))).toBeNull();
    expect(clientIp(new Headers({ 'x-forwarded-for': '300.1.1.1' }))).toBeNull();
  });
});
