import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/server/env';
import { POST } from './route';

const SECRET = 'a'.repeat(33);

function call(authorization: string) {
  const req = new NextRequest('http://localhost/api/v1/internal/jobs/attention-scan', { method: 'POST', headers: { authorization } });
  return POST(req, { params: Promise.resolve({}) });
}

describe('attention-scan trigger', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/unit');
    vi.stubEnv('INTERNAL_JOB_SECRET', SECRET);
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('answers a wrong token the same way whatever its length or bytes', async () => {
    for (const token of ['b'.repeat(32), 'b'.repeat(33), 'b'.repeat(34), 'é'.repeat(33)]) {
      expect((await call(`Bearer ${token}`)).status, token).toBe(403);
    }
  });

  it('treats the placeholder from .env.example as no secret at all', async () => {
    vi.stubEnv('INTERNAL_JOB_SECRET', 'change-me-to-a-long-random-string');
    resetEnvCache();
    expect((await call('Bearer change-me-to-a-long-random-string')).status).toBe(403);
  });
});
