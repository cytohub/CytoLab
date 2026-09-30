import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

function visit(url: string, host: string) {
  return proxy(new NextRequest(url, { headers: { host } }));
}

describe('proxy (production)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_URL', 'https://cytolab.ai');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('redirects www to the canonical origin, keeping path and query', () => {
    const res = visit('http://10.0.0.5:8080/experiments?status=planned', 'www.cytolab.ai');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://cytolab.ai/experiments?status=planned');
  });

  it('keeps a protocol-relative-looking path on the canonical host', () => {
    const res = visit('http://10.0.0.5:8080//evil.example/login', 'www.cytolab.ai');
    expect(new URL(res.headers.get('location')!).host).toBe('cytolab.ai');
  });

  it('serves the canonical and platform hosts with a nonce-based CSP', () => {
    for (const host of ['cytolab.ai', 'cytolab-production.up.railway.app']) {
      const res = visit('http://10.0.0.5:8080/dashboard', host);
      expect(res.headers.get('location'), host).toBeNull();
      expect(res.headers.get('content-security-policy'), host).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    }
  });
});
