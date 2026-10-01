import { afterAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { AppError } from '../../src/domain/errors';
import { createSession } from '../../src/server/auth/sessions';
import { closeDb } from '../../src/server/db/client';
import { updateMember } from '../../src/server/modules/directory/service';
import { createExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import { createMilestone } from '../../src/server/modules/projects/milestones';
import { createProject, updateProject } from '../../src/server/modules/projects/service';
import { POST as logout } from '../../src/app/api/v1/auth/logout/route';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function statusOf(promise: Promise<unknown>): Promise<number | 'ok'> {
  return promise.then(
    () => 'ok' as const,
    (err: unknown) => {
      if (err instanceof AppError) return err.status;
      throw err;
    },
  );
}

function projectInput(ownerId: string) {
  return { name: 'P', code: `RG-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'active' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null };
}

describe('assigning work to inactive members (integration)', () => {
  it('refuses suspended members as new owners, researchers or milestone owners', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const suspended = await ws.addUser('scientist');
    await updateMember(admin, suspended.userId, { status: 'suspended' });

    expect(await statusOf(createProject(admin, projectInput(suspended.userId)))).toBe(422);
    const project = await createProject(admin, projectInput(admin.userId));
    expect(await statusOf(createMilestone(admin, project.id, { title: 'M', ownerId: suspended.userId }))).toBe(422);
    expect(await statusOf(createExperiment(admin, { projectId: project.id, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId: suspended.userId, teamId: null, status: 'planned', priority: 'medium', startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] }))).toBe(422);
  });

  it('still saves records whose existing owner was suspended later', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const owner = await ws.addUser('scientist');
    const project = await createProject(admin, projectInput(owner.userId));
    const experiment = await createExperiment(admin, { projectId: project.id, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId: owner.userId, teamId: null, status: 'planned', priority: 'medium', startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] });
    await updateMember(admin, owner.userId, { status: 'suspended' });

    // Edit forms send every field back, including the unchanged owner.
    expect(await statusOf(updateProject(admin, project.code, { name: 'Renamed', ownerId: owner.userId }))).toBe('ok');
    expect(await statusOf(updateExperiment(admin, experiment.id, { name: 'Renamed', researcherId: owner.userId }))).toBe('ok');
  });
});

describe('sign-out (integration)', () => {
  it('expires the session cookie with every attribute it was set with', async () => {
    const ws = await createWorkspace();
    const member = await ws.addUser('researcher');
    const session = await createSession(member.userId, ws.orgId, { requestId: 'test', ip: null, userAgent: null });
    const req = new NextRequest('http://localhost/api/v1/auth/logout', { method: 'POST', headers: { origin: 'http://localhost', cookie: `cytolab_session=${session.token}` } });
    const res = await logout(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/cytolab_session=;/);
    expect(setCookie).toMatch(/Max-Age=0/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/HttpOnly/i);
  });
});
