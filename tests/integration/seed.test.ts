import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createAuthContext } from '../../src/server/auth/context';
import { closeDb, db } from '../../src/server/db/client';
import { experiments, experimentTypes, organizations, orgMemberships, projects, users } from '../../src/server/db/schema';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { linkSample } from '../../src/server/modules/experiments/sub-records';
import { seedDemoData } from '../../scripts/seed/seed';

afterAll(async () => {
  await closeDb();
});

describe('demo seed (integration)', () => {
  it('leaves the counters past the seeded numbers, so new experiments and samples can be created', async () => {
    await seedDemoData();

    const [org] = await db().select().from(organizations).where(eq(organizations.slug, 'acme-bio'));
    const [admin] = await db()
      .select({ id: users.id, name: users.name, email: users.email })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(and(eq(orgMemberships.orgId, org!.id), eq(orgMemberships.role, 'admin')))
      .limit(1);
    const ctx = createAuthContext({
      userId: admin!.id,
      orgId: org!.id,
      role: 'admin',
      teamIds: [],
      sessionId: null,
      requestId: 'seed-test',
      user: { name: admin!.name, email: admin!.email, title: null, avatarColor: 'blue', avatarUrl: null },
      org: { name: org!.name, slug: org!.slug, timezone: org!.timezone, isDemo: true },
    });
    const [project] = await db().select({ id: projects.id }).from(projects).where(eq(projects.orgId, org!.id)).limit(1);
    const [type] = await db().select({ id: experimentTypes.id }).from(experimentTypes).where(eq(experimentTypes.orgId, org!.id)).limit(1);
    const seeded = await db().select({ number: experiments.number }).from(experiments).where(eq(experiments.orgId, org!.id));
    const highest = Math.max(...seeded.map((e) => e.number));

    const created = await createExperiment(ctx, { projectId: project!.id, experimentTypeId: type!.id, name: 'After reset', objective: null, hypothesis: null, researcherId: admin!.id, teamId: null, status: 'planned', priority: 'medium', startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] });
    expect(created.displayId).toBe(`EXP-${highest + 1}`);

    const { sampleId } = await linkSample(ctx, created.id, { role: 'output', sample: { name: 'Fresh aliquot', sampleType: 'Cell pellet' } });
    expect(sampleId).toBeTruthy();
  }, 60_000);
});
