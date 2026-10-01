import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { closeDb, db } from '../../src/server/db/client';
import { milestones } from '../../src/server/db/schema';
import { toAppError } from '../../src/server/http/api';
import { createTag, setEntityTags } from '../../src/server/modules/collaboration/service';
import { updateExperimentType } from '../../src/server/modules/config/service';
import { addTeamMember, updateMember, updateProfile, updateTeam } from '../../src/server/modules/directory/service';
import { createExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import { resolveExperimentId } from '../../src/server/modules/experiments/service';
import { createMilestone, updateMilestone } from '../../src/server/modules/projects/milestones';
import { createProject, getProject, updateProject } from '../../src/server/modules/projects/service';
import { search } from '../../src/server/modules/search/service';
import type { AuthContext } from '../../src/server/auth/context';
import { createWorkspace, type TestWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

function projectInput(ownerId: string, overrides: Partial<{ code: string; teamId: string | null; name: string }> = {}) {
  return { name: 'P', code: `CS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'active' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null, ...overrides };
}

function experimentInput(ws: TestWorkspace, projectId: string, researcherId: string) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Titration run', objective: null, hypothesis: null, researcherId, teamId: null, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

async function setup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const project = await createProject(admin, projectInput(admin.userId, { teamId: ws.teamId }));
  const experiment = await createExperiment(admin, experimentInput(ws, project.id, admin.userId));
  return { ws, admin, project, experiment };
}

/** IDs of every search hit for a query. */
async function hitIds(ctx: AuthContext, q: string): Promise<string[]> {
  const result = await search(ctx, { q, types: undefined, limit: 20 });
  return result.groups.flatMap((g) => g.hits.map((h) => h.id));
}

async function statusOf(promise: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await promise;
    return 'ok';
  } catch (err) {
    const appError = toAppError(err);
    if (appError) return appError.status;
    throw err;
  }
}

describe('optimistic concurrency (integration)', () => {
  it('lets exactly one of several simultaneous experiment saves win', async () => {
    const { admin, experiment } = await setup();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, (_, i) => statusOf(updateExperiment(admin, experiment.id, { name: `Edit ${i}`, expectedVersion: experiment.version }))),
    );
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 409)).toHaveLength(5);
  });

  it('lets exactly one of several simultaneous project saves win', async () => {
    const { admin, project } = await setup();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, (_, i) => statusOf(updateProject(admin, project.code, { name: `Edit ${i}`, expectedVersion: project.version }))),
    );
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 409)).toHaveLength(5);
  });
});

describe('milestone numbering (integration)', () => {
  it('gives simultaneous creates distinct numbers', async () => {
    const { admin, project } = await setup();
    const created = await Promise.all(Array.from({ length: 6 }, (_, i) => createMilestone(admin, project.id, { title: `M ${i}` })));
    expect(new Set(created.map((m) => m.sequence)).size).toBe(6);
    expect(created.map((m) => m.sequence).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('continues after milestones that were numbered without the counter', async () => {
    const { ws, admin, project } = await setup();
    // The seed writes milestones directly, so the counter has never seen M7.
    await db().insert(milestones).values({ orgId: ws.orgId, projectId: project.id, sequence: 7, title: 'Seeded', status: 'pending', position: 0 });
    const next = await createMilestone(admin, project.id, { title: 'Next' });
    expect(next.sequence).toBe(8);
  });
});

describe('references that look like UUIDs (integration)', () => {
  it('resolves a project code that starts with eight hex digits and a dash', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    await createProject(admin, projectInput(admin.userId, { code: '20250101-A' }));
    expect((await getProject(admin, '20250101-A')).code).toBe('20250101-A');
    expect((await getProject(admin, '20250101-a')).code).toBe('20250101-A');
  });

  it('answers a malformed UUID path with 404', async () => {
    const { admin } = await setup();
    expect(await statusOf(updateMilestone(admin, 'not-a-uuid', { title: 'x' }))).toBe(404);
    const err = await resolveExperimentId(admin, 'deadbeef-0000').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
  });
});

describe('search freshness (integration)', () => {
  it('finds an experiment by fields edited after creation', async () => {
    const { admin, experiment } = await setup();
    await updateExperiment(admin, experiment.id, { objective: 'Quantify electroporation efficiency' });
    expect(await hitIds(admin, 'electroporation')).toContain(experiment.id);

    await updateExperiment(admin, experiment.id, { resultsSummary: 'Transfection plateaued near 80 percent' });
    expect(await hitIds(admin, 'plateaued')).toContain(experiment.id);
  });

  it('finds an experiment by a tag applied later, and stops once it is removed', async () => {
    const { ws, admin, experiment } = await setup();
    const tag = await createTag(admin, { name: `kinetics${ws.orgId.slice(-4)}`, color: 'slate' });
    await setEntityTags(admin, experiment.id, [tag.id]);
    expect(await hitIds(admin, tag.name)).toContain(experiment.id);
    await setEntityTags(admin, experiment.id, []);
    expect(await hitIds(admin, tag.name)).not.toContain(experiment.id);
  });

  it('follows renamed experiment types, teams and people into the documents that name them', async () => {
    const { ws, admin, project, experiment } = await setup();

    await updateExperimentType(admin, ws.typeId, { name: 'Spheroid invasion assay' });
    expect(await hitIds(admin, 'spheroid')).toContain(experiment.id);

    const scientist = await ws.addUser('scientist');
    await addTeamMember(admin, ws.teamId, { userId: scientist.userId, role: 'member' });
    await updateTeam(admin, ws.teamId, { name: 'Organoid Core' });
    const byTeam = await hitIds(admin, 'organoid');
    expect(byTeam).toContain(project.id);
    expect(byTeam).toContain(scientist.userId);

    await updateProfile(admin, { name: 'Imogen Valdivia', title: 'Principal Investigator' });
    const byName = await hitIds(admin, 'valdivia');
    expect(byName).toEqual(expect.arrayContaining([admin.userId, project.id, experiment.id]));
    expect(await hitIds(admin, 'principal investigator')).toContain(admin.userId);

    await updateMember(admin, scientist.userId, { name: 'Tomasz Okonkwo' });
    expect(await hitIds(admin, 'okonkwo')).toContain(scientist.userId);
  });
});
