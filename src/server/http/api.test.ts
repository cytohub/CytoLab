import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/domain/errors';
import { resetEnvCache } from '../env';
import { z } from 'zod';
import { PayloadTooLargeError } from '@/domain/errors';
import { NextRequest as Req } from 'next/server';
import { assertSameOrigin, ok, parseJson, publicApi, readBodyCapped, toAppError, zodFieldErrors } from './api';

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
    const req = request('POST', { host: '10.0.0.5:8080', 'x-forwarded-host': 'www.cytolab.ai', 'x-forwarded-proto': 'https', origin: 'https://www.cytolab.ai' });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it('rejects a page on the plain-http address of an https site', () => {
    const req = request('POST', { host: 'cytolab.ai', 'x-forwarded-proto': 'https', origin: 'http://cytolab.ai', cookie: 'cytolab_session=token' });
    expect(() => assertSameOrigin(req)).toThrow(ForbiddenError);
  });

  it('accepts a plain-http local server reached directly', () => {
    const req = request('POST', { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }, 'http://127.0.0.1:3000/api/v1/tags');
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

  it('turns a malformed UUID or a NUL byte in the path into a 404, not a 500', () => {
    expect(toAppError(pg('22P02'))?.status).toBe(404);
    expect(toAppError(pg('22021'))?.status).toBe(404);
  });

  it('reports other data exceptions as invalid input', () => {
    expect(toAppError(pg('22008'))?.status).toBe(422); // datetime out of range
    expect(toAppError(pg('22003'))?.status).toBe(422); // numeric out of range
  });

  it('keeps mapping constraint violations, without naming the constraint', () => {
    const conflict = toAppError(Object.assign(new Error('Failed query'), { cause: { code: '23505', constraint_name: 'tags_org_name_unique' } }));
    expect(conflict?.status).toBe(409);
    expect(JSON.stringify(conflict?.details ?? {})).not.toContain('tags_org_name_unique');
    expect(toAppError(pg('23503'))?.status).toBe(400);
    expect(toAppError(pg('23514'))?.status).toBe(422);
  });

  it('leaves unknown errors for the 500 handler', () => {
    expect(toAppError(new Error('boom'))).toBeNull();
  });
});

describe('readBodyCapped', () => {
  /** A chunked body (no Content-Length) that records how much of it was pulled. */
  function chunkedRequest(chunks: number, chunkBytes: number) {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= chunks) return controller.close();
        pulled += 1;
        controller.enqueue(new Uint8Array(chunkBytes).fill(97));
      },
    });
    const req = new Request('http://localhost/api/v1/auth/login', { method: 'POST', body, headers: { 'content-type': 'application/json' }, duplex: 'half' } as RequestInit);
    return { req, pulled: () => pulled };
  }

  it('stops reading as soon as a chunked body passes the limit', async () => {
    const { req, pulled } = chunkedRequest(1_000, 100);
    await expect(readBodyCapped(req, 1_000)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(pulled()).toBeLessThan(20); // ~11 chunks, not all 1,000
  });

  it('returns bodies within the limit', async () => {
    const { req } = chunkedRequest(5, 100);
    expect((await readBodyCapped(req, 1_000)).byteLength).toBe(500);
  });

  it('refuses a declared Content-Length over the limit without reading', async () => {
    const req = new Request('http://localhost/x', { method: 'POST', body: 'x'.repeat(10), headers: { 'content-length': '5000' } });
    await expect(readBodyCapped(req, 1_000)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});

describe('parseJson', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/unit');
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  function jsonRequest(body: string | ReadableStream<Uint8Array>, contentType = 'application/json') {
    return new Request('http://localhost/api/v1/tags', { method: 'POST', body, headers: { 'content-type': contentType }, duplex: 'half' } as RequestInit);
  }
  /** A chunked body (no Content-Length) of `kib` KiB. */
  function chunked(kib: number) {
    let sent = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ >= kib) return controller.close();
        controller.enqueue(new Uint8Array(1_024).fill(32));
      },
    });
  }

  it('applies the cap to bodies sent without Content-Length', async () => {
    await expect(parseJson(jsonRequest(chunked(2_048)) as never, z.object({}))).rejects.toBeInstanceOf(PayloadTooLargeError); // 2 MB against 1 MB
  });

  it('keeps bodies to 32 KB in a public demo', async () => {
    const schema = z.object({ notes: z.string() });
    const body = (kib: number) => JSON.stringify({ notes: 'a'.repeat(kib * 1_024) });
    expect(await parseJson(jsonRequest(body(40)) as never, schema)).toMatchObject({ notes: expect.any(String) });

    vi.stubEnv('PUBLIC_DEMO', 'true');
    resetEnvCache();
    await expect(parseJson(jsonRequest(body(40)) as never, schema)).rejects.toThrow('Payload exceeds the 32 KB limit');
    expect(await parseJson(jsonRequest(body(30)) as never, schema)).toMatchObject({ notes: expect.any(String) });
  });

  it('accepts application/json with parameters, and nothing that merely mentions it', async () => {
    const schema = z.object({ a: z.number() });
    expect(await parseJson(jsonRequest('{"a":1}', 'Application/JSON; charset=utf-8') as never, schema)).toEqual({ a: 1 });
    for (const type of ['text/plain;charset=application/json', 'text/plain; application/json', 'application/jsonp', '']) {
      await expect(parseJson(jsonRequest('{"a":1}', type) as never, schema), type).rejects.toMatchObject({ status: 415 });
    }
  });
});

describe('zodFieldErrors', () => {
  it('lists at most 50 fields however many issues there are', () => {
    const result = z.array(z.string()).safeParse(Array.from({ length: 500 }, () => 1));
    expect(Object.keys(zodFieldErrors(result.error!))).toHaveLength(50);
  });
});

describe('response envelope', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/unit');
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  const handler = publicApi(async () => ok({ fine: true }));
  const call = (headers: Record<string, string>) => handler(new Req('http://localhost/api/v1/health', { headers }), { params: Promise.resolve({}) });

  it('keeps a plain correlation ID and replaces anything else', async () => {
    expect((await call({ 'x-request-id': 'trace-123.abc' })).headers.get('x-request-id')).toBe('trace-123.abc');
    for (const bad of ['has space', 'x'.repeat(65), '<script>']) {
      const id = (await call({ 'x-request-id': bad })).headers.get('x-request-id');
      expect(id).not.toBe(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('gives API responses a CSP that loads and runs nothing', async () => {
    expect((await call({})).headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
  });
});
