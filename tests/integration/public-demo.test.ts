import { NextRequest } from 'next/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PUBLIC_DEMO_LOCKS, PUBLIC_DEMO_WRITE_LIMIT } from '../../src/domain/public-demo';
import { createSession } from '../../src/server/auth/sessions';
import { resetEnvCache } from '../../src/server/env';
import { demoWriteLimiter } from '../../src/server/http/public-demo';
import { PATCH as updateProfile } from '../../src/app/api/v1/me/route';
import { POST as uploadAttachment } from '../../src/app/api/v1/entities/[id]/attachments/route';
import { POST as createTag } from '../../src/app/api/v1/tags/route';
import { createWorkspace } from './helpers';

/**
 * Drives real route handlers the way the deployed app receives them: a browser
 * on https://cytolab.ai, a TLS-terminating proxy, and a server that only sees
 * plain HTTP on an internal address.
 */
let token = '';
let requests = 0;

function send(path: string, method: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://10.0.0.5:8080/api/v1${path}`, {
    method,
    body: init.body,
    headers: {
      host: 'cytolab.ai',
      'x-forwarded-proto': 'https',
      origin: 'https://cytolab.ai',
      cookie: `cytolab_session=${token}`,
      // FormData bodies get their multipart boundary from fetch itself.
      ...(typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
}
const route = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
const newTag = () => JSON.stringify({ name: `demo-tag-${(requests += 1)}` });

async function errorOf(res: Response) {
  return ((await res.json()) as { error: { code: string; message: string } }).error;
}

function setPublicDemo(on: boolean) {
  vi.stubEnv('PUBLIC_DEMO', on ? 'true' : 'false');
  resetEnvCache();
}

describe('public demo deployment', () => {
  beforeAll(async () => {
    const ws = await createWorkspace('demo');
    const admin = await ws.addUser('admin');
    ({ token } = await createSession(admin.userId, ws.orgId, { requestId: 'test', ip: null, userAgent: null }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('accepts same-site writes that arrive through the proxy', async () => {
    const res = await createTag(send('/tags', 'POST', { body: newTag() }), route({}));
    expect(res.status).toBe(201);
  });

  it('rejects cross-site writes before anything else', async () => {
    setPublicDemo(true);
    const res = await updateProfile(send('/me', 'PATCH', { body: '{}', headers: { origin: 'https://evil.example' } }), route({}));
    expect(res.status).toBe(403);
    expect((await errorOf(res)).message).toBe('Cross-origin request rejected');
  });

  it('refuses account and file changes, without reading the upload', async () => {
    setPublicDemo(true);
    const profile = await updateProfile(send('/me', 'PATCH', { body: JSON.stringify({ name: 'Renamed' }) }), route({}));
    expect(profile.status).toBe(403);
    expect((await errorOf(profile)).message).toBe(PUBLIC_DEMO_LOCKS.people);

    const form = new FormData();
    form.append('file', new File(['synthetic'], 'notes.txt', { type: 'text/plain' }));
    const upload = await uploadAttachment(
      send('/entities/0190f4a0-0000-7000-8000-000000000000/attachments', 'POST', { body: form }),
      route({ id: '0190f4a0-0000-7000-8000-000000000000' }),
    );
    expect(upload.status).toBe(403);
    expect((await errorOf(upload)).message).toBe(PUBLIC_DEMO_LOCKS.files);
  });

  it('keeps research work writable', async () => {
    setPublicDemo(true);
    const res = await createTag(send('/tags', 'POST', { body: newTag() }), route({}));
    expect(res.status).toBe(201);
  });

  it('limits one visitor’s writes and says when to retry', async () => {
    setPublicDemo(true);
    const ip = '203.0.113.50';
    try {
      for (let i = 0; i < PUBLIC_DEMO_WRITE_LIMIT.limit; i++) demoWriteLimiter.consume(ip);
      const res = await createTag(send('/tags', 'POST', { body: newTag(), headers: { 'x-forwarded-for': ip } }), route({}));
      expect(res.status).toBe(429);
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
      expect((await errorOf(res)).code).toBe('rate_limited');
    } finally {
      demoWriteLimiter.reset(ip);
    }
  });

  it('leaves profiles editable when the deployment is not a public demo', async () => {
    const res = await updateProfile(send('/me', 'PATCH', { body: JSON.stringify({ title: 'Staff Scientist' }) }), route({}));
    expect(res.status).toBe(200);
  });
});
