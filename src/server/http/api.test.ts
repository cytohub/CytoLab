import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/domain/errors';
import { resetEnvCache } from '../env';
import { assertSameOrigin, toAppError } from './api';

// The app behind a TLS-terminating proxy: the server sees an internal address
// over plain HTTP, while the browser talks to https://cytolab.ai.
const INTERNAL_URL = 'http://10.0.0.5:8080/api/v1/tags';

function request(method: string, headers: Record<string, string>, url = INTERNAL_URL) {
  return new NextRequest(url, { method, headers });
}

describe('assertSameOrigin', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/unit');
    vi.stubEnv('APP_URL', 'https://staging.example.org');
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('accepts a same-site write that arrives through a proxy', () => {
    const req = request('POST', { host: 'cytolab.ai', 'x-forwarded-proto': 'https', origin: 'https://cytolab.ai' });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it('compares against the forwarded host when the proxy rewrites Host', () => {
    const req = request('POST', { host: '10.0.0.5:8080', 'x-forwarded-host': 'www.cytolab.ai', origin: 'https://www.cytolab.ai' });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it('accepts the configured APP_URL origin', () => {
    expect(() => assertSameOrigin(request('POST', { origin: 'https://staging.example.org' }))).not.toThrow();
  });

  it('rejects writes from other sites, including look-alike hosts', () => {
    for (const origin of ['https://evil.example', 'https://cytolab.ai.evil.example', 'https://evilcytolab.ai']) {
      const req = request('POST', { host: 'cytolab.ai', origin });
      expect(() => assertSameOrigin(req), origin).toThrow(ForbiddenError);
    }
  });

  it('rejects the opaque origin "null"', () => {
    expect(() => assertSameOrigin(request('POST', { host: 'cytolab.ai', origin: 'null' }))).toThrow(ForbiddenError);
  });

  it('requires an Origin on cookie-authenticated writes', () => {
    const req = request('DELETE', { host: 'cytolab.ai', cookie: 'cytolab_session=token' });
    expect(() => assertSameOrigin(req)).toThrow('Missing Origin');
  });

  it('ignores reads', () => {
    expect(() => assertSameOrigin(request('GET', { host: 'cytolab.ai', origin: 'https://evil.example' }))).not.toThrow();
  });
});

describe('toAppError', () => {
  // Drizzle wraps driver errors, so the Postgres code sits on `cause`.
  const pg = (code: string) => Object.assign(new Error('Failed query'), { cause: { code } });

  it('turns a malformed UUID in the path into a 404, not a 500', () => {
    expect(toAppError(pg('22P02'))?.status).toBe(404);
  });

  it('keeps mapping constraint violations', () => {
    expect(toAppError(pg('23505'))?.status).toBe(409);
    expect(toAppError(pg('23503'))?.status).toBe(400);
    expect(toAppError(pg('23514'))?.status).toBe(422);
  });

  it('leaves unknown errors for the 500 handler', () => {
    expect(toAppError(new Error('boom'))).toBeNull();
  });
});
