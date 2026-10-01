import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { closeDb } from '../../src/server/db/client';
import { createLink, createTag } from '../../src/server/modules/collaboration/service';
import { createExperimentType } from '../../src/server/modules/config/service';
import { createTeam } from '../../src/server/modules/directory/service';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { listExperiments } from '../../src/server/modules/experiments/service';
import { createProject, listProjects } from '../../src/server/modules/projects/service';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function errorOf(promise: Promise<unknown>): Promise<AppError> {
  const err = await promise.then(() => null, (e: unknown) => e);
  if (err instanceof AppError) return err;
  throw err ?? new Error('expected an AppError');
}

function projectInput(ownerId: string, name: string) {
  return { name, code: `HD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'active' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null };
}

describe('duplicate names (integration)', () => {
  it('get a field-level 422 instead of a 409 naming the constraint', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');

    await createTag(admin, { name: 'qc', color: 'slate' });
    const tag = await errorOf(createTag(admin, { name: 'qc', color: 'slate' }));
    expect(tag.status).toBe(422);
    expect(tag.details?.fields).toHaveProperty('name');

    await createTeam(admin, { name: 'Imaging', description: null, color: 'blue' });
    expect((await errorOf(createTeam(admin, { name: 'Imaging', description: null, color: 'blue' }))).status).toBe(422);

    await createExperimentType(admin, { name: 'ELISA', category: 'Assay', description: null, color: 'blue' });
    expect((await errorOf(createExperimentType(admin, { name: 'ELISA', category: 'Assay', description: null, color: 'blue' }))).status).toBe(422);

    const project = await createProject(admin, projectInput(admin.userId, 'Linked'));
    const exp = await createExperiment(admin, { projectId: project.id, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId: admin.userId, teamId: null, status: 'planned', priority: 'medium', startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] });
    await createLink(admin, exp.id, { targetId: project.id, linkType: 'references' });
    expect((await errorOf(createLink(admin, exp.id, { targetId: project.id, linkType: 'references' }))).status).toBe(422);
  });
});

describe('list filters (integration)', () => {
  it('match % and _ literally', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    await createProject(admin, projectInput(admin.userId, 'Alpha'));
    await createProject(admin, projectInput(admin.userId, 'Yield 40% plateau'));

    expect((await listProjects(admin, { q: '%' } as never)).items.map((p) => p.name)).toEqual(['Yield 40% plateau']);
    expect((await listProjects(admin, { q: '_' } as never)).items).toHaveLength(0);
    expect((await listExperiments(admin, { q: '%' } as never)).items).toHaveLength(0);
  });
});
