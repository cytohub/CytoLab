import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AppError } from '../../src/domain/errors';
import { hashPassword } from '../../src/server/auth/password';
import { createSession, resolveSession } from '../../src/server/auth/sessions';
import { closeDb, db } from '../../src/server/db/client';
import { organizations, orgMemberships, users } from '../../src/server/db/schema';
import { uuidv7 } from '../../src/server/db/uuid';
import { resetEnvCache } from '../../src/server/env';
import { listDemoAccounts, login } from '../../src/server/modules/auth/service';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const meta = { requestId: 'test', ip: '198.51.100.30', userAgent: 'vitest' };

function asProduction(publicDemo: boolean) {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_DEMO', publicDemo ? 'true' : 'false');
  vi.stubEnv('DEMO_MODE', 'true');
  resetEnvCache();
}

async function demoAccount() {
  const ws = await createWorkspace('demo');
  await db().update(organizations).set({ isDemo: true }).where(eq(organizations.id, ws.orgId));
  const userId = uuidv7();
  const email = `${userId}@example.com`;
  await db().insert(users).values({ id: userId, email, name: 'Demo person', status: 'active', passwordHash: await hashPassword('cytolab-demo') });
  await db().insert(orgMemberships).values({ orgId: ws.orgId, userId, role: 'admin', status: 'active' });
  return { ws, userId, email };
}

describe('demo workspaces in production (integration)', () => {
  it('refuse sign-in, existing sessions and the account list unless this is a public demo', async () => {
    const { ws, userId, email } = await demoAccount();
    const session = await createSession(userId, ws.orgId, meta);

    asProduction(false);
    const err = await login({ email, password: 'cytolab-demo' }, meta).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(401);
    expect(await resolveSession(session.token, meta)).toBeNull();
    expect((await listDemoAccounts()).enabled).toBe(false);

    asProduction(true);
    expect((await login({ email, password: 'cytolab-demo' }, meta)).orgId).toBe(ws.orgId);
    expect(await resolveSession(session.token, meta)).not.toBeNull();
  });

  it('leave real workspaces alone', async () => {
    const ws = await createWorkspace('real');
    const userId = uuidv7();
    const email = `${userId}@example.com`;
    await db().insert(users).values({ id: userId, email, name: 'Real person', status: 'active', passwordHash: await hashPassword('a strong one') });
    await db().insert(orgMemberships).values({ orgId: ws.orgId, userId, role: 'scientist', status: 'active' });

    asProduction(false);
    expect((await login({ email, password: 'a strong one' }, meta)).orgId).toBe(ws.orgId);
  });
});
