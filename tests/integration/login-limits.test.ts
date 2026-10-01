import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { hashPassword } from '../../src/server/auth/password';
import { closeDb, db } from '../../src/server/db/client';
import { orgMemberships, users } from '../../src/server/db/schema';
import { uuidv7 } from '../../src/server/db/uuid';
import { login } from '../../src/server/modules/auth/service';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function attempt(email: string, password: string, ip: string): Promise<number | 'ok'> {
  try {
    await login({ email, password }, { requestId: 'test', ip, userAgent: 'vitest' });
    return 'ok';
  } catch (err) {
    if (err instanceof AppError) return err.status;
    throw err;
  }
}

describe('sign-in limits (integration)', () => {
  it('caps guesses against one account even when every guess comes from a new address', async () => {
    const ws = await createWorkspace();
    const userId = uuidv7();
    const email = `${userId}@example.com`;
    await db().insert(users).values({ id: userId, email, name: 'Target', status: 'active', passwordHash: await hashPassword('the real one') });
    await db().insert(orgMemberships).values({ orgId: ws.orgId, userId, role: 'scientist', status: 'active' });

    const outcomes: Array<number | 'ok'> = [];
    for (let i = 0; i < 31; i++) outcomes.push(await attempt(email, `guess-${i}`, `198.18.${Math.floor(i / 250)}.${i % 250}`));
    expect(outcomes.slice(0, 30).every((o) => o === 401)).toBe(true);
    expect(outcomes[30]).toBe(429);
  });

  it('caps attempts from one address spread across many accounts', async () => {
    const ip = '198.19.7.7';
    const outcomes: Array<number | 'ok'> = [];
    for (let i = 0; i < 61; i++) outcomes.push(await attempt(`spray-${i}-${uuidv7()}@example.com`, 'Winter2026!', ip));
    expect(outcomes.slice(0, 60).every((o) => o === 401)).toBe(true);
    expect(outcomes[60]).toBe(429);
  });

  it('counts an IPv6 /64 as one address', async () => {
    const email = `${uuidv7()}@example.com`;
    const outcomes: Array<number | 'ok'> = [];
    for (let i = 0; i < 11; i++) outcomes.push(await attempt(email, 'x', `2001:db8:77:1::${(i + 1).toString(16)}`));
    expect(outcomes[10]).toBe(429);
  });
});
