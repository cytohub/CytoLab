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

describe('proxy session cookie', () => {
  const TOKEN = 'Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0Z2FycGx5';
  const COOKIE = `__Host-cytolab_session=${TOKEN}`;
  const DAY = 24 * 60 * 60 * 1000;

  function visitWith(path: string, headers: Record<string, string>) {
    return proxy(new NextRequest(`http://10.0.0.5:8080${path}`, { headers: { host: 'cytolab.ai', ...headers } }));
  }
  const refreshed = (res: ReturnType<typeof proxy>, name = '__Host-cytolab_session') => res.cookies.get(name);

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_URL', 'https://cytolab.ai');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('pushes the expiry 14 days out on a page load', () => {
    const cookie = refreshed(visitWith('/experiments', { 'sec-fetch-dest': 'document', accept: 'text/html', cookie: COOKIE }));
    expect(cookie?.value).toBe(TOKEN);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    const expires = new Date(cookie!.expires!).getTime();
    expect(expires).toBeGreaterThan(Date.now() + 13 * DAY);
    expect(expires).toBeLessThanOrEqual(Date.now() + 14 * DAY);
  });

  it('refreshes on in-app navigations, which the router makes with fetch', () => {
    // By the time the proxy runs, Next has removed the RSC header and _rsc query.
    expect(refreshed(visitWith('/projects', { 'sec-fetch-dest': 'empty', accept: '*/*', cookie: COOKIE }))?.value).toBe(TOKEN);
  });

  it('falls back to Accept for clients without Fetch Metadata', () => {
    expect(refreshed(visitWith('/dashboard', { accept: 'text/html', cookie: COOKIE }))?.value).toBe(TOKEN);
    expect(refreshed(visitWith('/dashboard', { accept: '*/*', cookie: COOKIE }))).toBeUndefined();
  });

  it('never attaches the cookie to files, sub-resources, or requests without one', () => {
    expect(refreshed(visitWith('/icon.svg', { 'sec-fetch-dest': 'image', cookie: COOKIE }))).toBeUndefined();
    expect(refreshed(visitWith('/icon.svg', { 'sec-fetch-dest': 'empty', cookie: COOKIE }))).toBeUndefined();
    expect(refreshed(visitWith('/experiments', { 'sec-fetch-dest': 'script', cookie: COOKIE }))).toBeUndefined();
    expect(refreshed(visitWith('/experiments', { 'sec-fetch-dest': 'document' }))).toBeUndefined();
    expect(refreshed(visitWith('/experiments', { 'sec-fetch-dest': 'document', cookie: '__Host-cytolab_session=short' }))).toBeUndefined();
  });

  it('uses the development cookie name outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cookie = refreshed(visitWith('/experiments', { 'sec-fetch-dest': 'document', cookie: `cytolab_session=${TOKEN}` }), 'cytolab_session');
    expect(cookie?.value).toBe(TOKEN);
    expect(cookie?.secure).toBe(false);
  });
});
