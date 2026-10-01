import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { AppError } from '../../src/domain/errors';
import { hashPassword } from '../../src/server/auth/password';
import { closeDb, db } from '../../src/server/db/client';
import { orgMemberships, users } from '../../src/server/db/schema';
import { uuidv7 } from '../../src/server/db/uuid';
import { login } from '../../src/server/modules/auth/service';
import { createMember, getMember, updateMember } from '../../src/server/modules/directory/service';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  const err = await fn().then(() => null, (e: unknown) => e);
  if (err instanceof AppError) return err;
  throw err ?? new Error('expected an AppError');
}

const meta = { requestId: 'test', ip: '198.51.100.20', userAgent: 'vitest' };

describe('accounts shared across organizations (integration)', () => {
  it('will not attach an account another organization uses, or reveal its profile', async () => {
    const orgB = await createWorkspace('victim');
    const victim = await orgB.addUser('scientist');
    const [row] = await db().select({ email: users.email }).from(users).where(eq(users.id, victim.userId));

    const orgA = await createWorkspace('attacker');
    const adminA = await orgA.addUser('admin');
    const err = await expectError(() => createMember(adminA, { name: 'x', email: row!.email, title: null, role: 'viewer', teamIds: [] }));
    expect(err.status).toBe(422);
    expect(JSON.stringify(err.details)).not.toContain('scientist user');
    const memberships = await db().select().from(orgMemberships).where(eq(orgMemberships.userId, victim.userId));
    expect(memberships.map((m) => m.orgId)).toEqual([orgB.orgId]);
  });

  it('lets only the person rename an account that another organization shares', async () => {
    const orgA = await createWorkspace();
    const adminA = await orgA.addUser('admin');
    const shared = await orgA.addUser('scientist');
    const orgB = await createWorkspace();
    const adminB = await orgB.addUser('admin');
    await db().insert(orgMemberships).values({ orgId: orgB.orgId, userId: shared.userId, role: 'viewer', status: 'active' });

    expect((await expectError(() => updateMember(adminA, shared.userId, { name: 'Renamed by A' }))).status).toBe(403);
    expect((await getMember(adminB, shared.userId)).name).toBe('scientist user');

    // Membership fields stay with each organization, and resending the current name is fine.
    await updateMember(adminA, shared.userId, { role: 'lab_manager', name: 'scientist user' });
    expect((await getMember(adminA, shared.userId)).role.value).toBe('lab_manager');
  });

  it('still lets an admin rename someone only their organization has', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const member = await ws.addUser('researcher');
    await updateMember(admin, member.userId, { name: 'Renamed' });
    expect((await getMember(admin, member.userId)).name).toBe('Renamed');
  });
});

describe('sign-in organization (integration)', () => {
  it('signs into the oldest active membership, skipping a suspended older one', async () => {
    const older = await createWorkspace('older');
    const newer = await createWorkspace('newer');
    const userId = uuidv7();
    const email = `${userId}@example.com`;
    await db().insert(users).values({ id: userId, email, name: 'Dual', status: 'active', passwordHash: await hashPassword('correct horse') });
    await db().insert(orgMemberships).values({ orgId: older.orgId, userId, role: 'viewer', status: 'suspended', createdAt: new Date(Date.now() - 86_400_000) });
    await db().insert(orgMemberships).values({ orgId: newer.orgId, userId, role: 'scientist', status: 'active' });

    const result = await login({ email, password: 'correct horse' }, meta);
    expect(result.orgId).toBe(newer.orgId);
  });

  it('refuses an account with no active membership', async () => {
    const ws = await createWorkspace();
    const userId = uuidv7();
    const email = `${userId}@example.com`;
    await db().insert(users).values({ id: userId, email, name: 'Pending', status: 'active', passwordHash: await hashPassword('correct horse') });
    await db().insert(orgMemberships).values({ orgId: ws.orgId, userId, role: 'viewer', status: 'invited' });
    expect((await expectError(() => login({ email, password: 'correct horse' }, meta))).status).toBe(401);
  });
});
