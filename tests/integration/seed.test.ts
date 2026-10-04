import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { AppError } from '../../src/domain/errors';
import { createAuthContext, type AuthContext } from '../../src/server/auth/context';
import { closeDb, db } from '../../src/server/db/client';
import { resetEnvCache } from '../../src/server/env';
import { experiments, experimentTypes, organizations, orgMemberships, projects, users } from '../../src/server/db/schema';
import { listDemoAccounts, login } from '../../src/server/modules/auth/service';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { createProject } from '../../src/server/modules/projects/service';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, ORG, PEOPLE } from '../../scripts/seed/catalog';
import { seedDemoData } from '../../scripts/seed/seed';

let orgId: string;

beforeAll(async () => {
  await seedDemoData();
  const [org] = await db().select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, ORG.slug));
  orgId = org!.id;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  resetEnvCache();
  await closeDb();
});

async function signInStatus(email: string, ip: string): Promise<number | 'ok'> {
  try {
    await login({ email, password: DEMO_PASSWORD }, { requestId: 'seed-test', ip, userAgent: 'vitest' });
    return 'ok';
  } catch (err) {
    if (err instanceof AppError) return err.status;
    throw err;
  }
}

async function contextFor(email: string): Promise<AuthContext> {
  const [row] = await db()
    .select({ id: users.id, name: users.name, role: orgMemberships.role })
    .from(users)
    .innerJoin(orgMemberships, and(eq(orgMemberships.userId, users.id), eq(orgMemberships.orgId, orgId)))
    .where(eq(users.email, email));
  return createAuthContext({
    userId: row!.id,
    orgId,
    role: row!.role,
    teamIds: [],
    sessionId: null,
    requestId: 'seed-test',
    user: { name: row!.name, email, title: null, avatarColor: 'blue', avatarUrl: null },
    org: { name: ORG.name, slug: ORG.slug, timezone: ORG.timezone, isDemo: true },
  });
}

describe('demo seed (integration)', () => {
  it('starts with no research data', async () => {
    expect(await db().select({ id: projects.id }).from(projects).where(eq(projects.orgId, orgId))).toHaveLength(0);
    expect(await db().select({ id: experiments.id }).from(experiments).where(eq(experiments.orgId, orgId))).toHaveLength(0);
  });

  it('lets visitors sign in only to the demo accounts, never as a team member', async () => {
    for (const [i, account] of DEMO_ACCOUNTS.entries()) expect(await signInStatus(account.email, `192.0.2.${100 + i}`)).toBe('ok');
    for (const [i, person] of PEOPLE.entries()) expect(await signInStatus(person.email, `192.0.2.${150 + i}`)).toBe(401);
  });

  it('never lists a team member on the sign-in page', async () => {
    // Other suites create demo workspaces too, so check the rule rather than the exact list:
    // the sign-in page lists active accounts, and here only the demo accounts are active.
    const active = await db()
      .select({ email: users.email })
      .from(users)
      .innerJoin(orgMemberships, and(eq(orgMemberships.userId, users.id), eq(orgMemberships.orgId, orgId)))
      .where(eq(users.status, 'active'));
    expect(active.map((a) => a.email).sort()).toEqual(DEMO_ACCOUNTS.map((a) => a.email).sort());

    vi.stubEnv('DEMO_MODE', 'true');
    resetEnvCache();
    const listed = (await listDemoAccounts()).accounts.map((a) => a.user.email);
    expect(listed.filter((email) => PEOPLE.some((p) => p.email === email))).toEqual([]);
  });

  it('lets a demo scientist create a project and an experiment with team members on it', async () => {
    const scientist = await contextFor('demo-scientist@cytohub.example');
    const [teamMember] = await db().select({ id: users.id }).from(users).where(eq(users.email, PEOPLE[0]!.email));
    const [type] = await db().select({ id: experimentTypes.id }).from(experimentTypes).where(eq(experimentTypes.orgId, orgId)).limit(1);

    const project = await createProject(scientist, { name: 'Visitor project', code: 'VIS-001', ownerId: scientist.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });
    const created = await createExperiment(scientist, { projectId: project.id, experimentTypeId: type!.id, name: 'First run', objective: null, hypothesis: null, researcherId: teamMember!.id, teamId: null, status: 'planned', priority: 'medium', startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] });
    expect(created.displayId).toBe('EXP-1001');
  }, 60_000);
});
