import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { closeDb } from '../../src/server/db/client';
import { createProject, deleteProject, getProject, listProjects, updateProject } from '../../src/server/modules/projects/service';
import { auditEntriesFor, createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('expected an AppError to be thrown');
}

describe('projects service (integration)', () => {
  it('creates a project and records activity + an audit entry', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');

    const project = await createProject(admin, { name: 'CAR-T', code: 'CART-1', ownerId: admin.userId, status: 'active', priority: 'high', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });

    expect(project.code).toBe('CART-1');
    expect(project.progressPercent).toBe(0);

    const audits = await auditEntriesFor(project.id);
    expect(audits.some((a) => a.action === 'create' && a.resourceType === 'project')).toBe(true);
  });

  it('isolates projects between organizations', async () => {
    const a = await createWorkspace();
    const b = await createWorkspace();
    const adminA = await a.addUser('admin');
    const adminB = await b.addUser('admin');

    await createProject(adminA, { name: 'Secret', code: 'SECRET-1', ownerId: adminA.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });

    const fromB = await listProjects(adminB);
    expect(fromB.items).toHaveLength(0);
    const err = await expectError(() => getProject(adminB, 'SECRET-1'));
    expect(err.status).toBe(404);
  });

  it('enforces RBAC: viewers and researchers cannot create projects', async () => {
    const ws = await createWorkspace();
    const viewer = await ws.addUser('viewer');
    const researcher = await ws.addUser('researcher');

    expect((await expectError(() => createProject(viewer, baseInput(viewer.userId)))).status).toBe(403);
    expect((await expectError(() => createProject(researcher, baseInput(researcher.userId)))).status).toBe(403);
  });

  it('rejects a scientist editing a project they neither own nor share a team with', async () => {
    const ws = await createWorkspace();
    const owner = await ws.addUser('scientist');
    const other = await ws.addUser('scientist');

    const project = await createProject(owner, baseInput(owner.userId));
    const err = await expectError(() => updateProject(other, project.code, { name: 'Hijacked' }));
    expect(err.status).toBe(403);
  });

  it('enforces optimistic concurrency on update', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const project = await createProject(admin, baseInput(admin.userId));

    const err = await expectError(() => updateProject(admin, project.code, { name: 'Stale', expectedVersion: project.version + 5 }));
    expect(err.status).toBe(409);
  });

  it('rejects a duplicate project code with a validation error', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    await createProject(admin, { ...baseInput(admin.userId), code: 'DUP-1' });
    const err = await expectError(() => createProject(admin, { ...baseInput(admin.userId), code: 'DUP-1' }));
    expect(err.status).toBe(422);
  });

  it('soft-deletes a project and hides it from lists', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const project = await createProject(admin, baseInput(admin.userId));

    await deleteProject(admin, project.code);
    const err = await expectError(() => getProject(admin, project.code));
    expect(err.status).toBe(404);
  });
});

function baseInput(ownerId: string) {
  return { name: 'Project', code: `P-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'planning' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null };
}
