import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { AppError } from '../../src/domain/errors';
import { closeDb, db } from '../../src/server/db/client';
import { entities, teamMemberships } from '../../src/server/db/schema';
import { createComment, createLink, createTag, deleteComment, deleteLink, listLinks, setEntityTags, updateComment } from '../../src/server/modules/collaboration/service';
import { updateMember } from '../../src/server/modules/directory/service';
import { createExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import { listExperiments, resolveExperimentId } from '../../src/server/modules/experiments/service';
import { createProject, deleteProject, updateProject } from '../../src/server/modules/projects/service';
import { createWorkspace, type TestWorkspace } from './helpers';

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

function projectInput(ownerId: string, teamId: string | null = null) {
  return { name: 'P', code: `AZ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'active' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId, startDate: null, targetDate: null, notes: null };
}
function experimentInput(ws: TestWorkspace, projectId: string, researcherId: string, teamId: string | null = null) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId, teamId, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

async function teamSetup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const owner = await ws.addUser('scientist', [ws.teamId]);
  const teammate = await ws.addUser('scientist', [ws.teamId]);
  await db().insert(teamMemberships).values([
    { teamId: ws.teamId, userId: owner.userId, orgId: ws.orgId },
    { teamId: ws.teamId, userId: teammate.userId, orgId: ws.orgId },
  ]);
  return { ws, admin, owner, teammate };
}

describe('ownership changes (integration)', () => {
  it('stops a teammate taking over a project or experiment they cannot delete', async () => {
    const { ws, owner, teammate } = await teamSetup();
    const project = await createProject(owner, projectInput(owner.userId, ws.teamId));
    expect(await statusOf(updateProject(teammate, project.code, { ownerId: teammate.userId }))).toBe(403);
    expect(await statusOf(updateProject(teammate, project.code, { name: 'Team edit' }))).toBe('ok'); // ordinary edits still work

    const experiment = await createExperiment(owner, experimentInput(ws, project.id, owner.userId, ws.teamId));
    expect(await statusOf(updateExperiment(teammate, experiment.id, { researcherId: teammate.userId }))).toBe(403);
    expect(await statusOf(updateExperiment(teammate, experiment.id, { notes: 'Team note' }))).toBe('ok');
  });

  it('still lets the owner or an admin hand work over', async () => {
    const { ws, admin, owner, teammate } = await teamSetup();
    const project = await createProject(owner, projectInput(owner.userId, ws.teamId));
    expect(await statusOf(updateProject(owner, project.code, { ownerId: teammate.userId }))).toBe('ok');
    expect(await statusOf(updateProject(admin, project.code, { ownerId: owner.userId }))).toBe('ok');
  });
});

describe('tags and links (integration)', () => {
  it('require edit rights on the record', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const researcher = await ws.addUser('researcher');
    const project = await createProject(admin, projectInput(admin.userId));
    const exp = await createExperiment(admin, experimentInput(ws, project.id, admin.userId));
    const exp2 = await createExperiment(admin, experimentInput(ws, project.id, admin.userId));
    const tag = await createTag(admin, { name: `glp-${ws.orgId.slice(-5)}`, color: 'red' });
    await setEntityTags(admin, exp.id, [tag.id]);
    const link = await createLink(admin, exp.id, { targetId: exp2.id, linkType: 'derived_from' });

    expect(await statusOf(setEntityTags(researcher, exp.id, []))).toBe(403);
    expect(await statusOf(deleteLink(researcher, link.id))).toBe(403);
    expect(await statusOf(createLink(researcher, project.id, { targetId: exp2.id, linkType: 'replicate_of' }))).toBe(403);
    expect(await listLinks(admin, exp.id)).toHaveLength(1);
  });

  it('let researchers manage tags and links on their own experiments, and remove links they made', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const researcher = await ws.addUser('researcher');
    const project = await createProject(admin, projectInput(admin.userId));
    const mine = await createExperiment(researcher, experimentInput(ws, project.id, researcher.userId));
    const theirs = await createExperiment(admin, experimentInput(ws, project.id, admin.userId));
    const tag = await createTag(admin, { name: `mine-${ws.orgId.slice(-5)}`, color: 'blue' });

    expect(await statusOf(setEntityTags(researcher, mine.id, [tag.id]))).toBe('ok');
    const link = await createLink(researcher, mine.id, { targetId: theirs.id, linkType: 'references' });
    expect(await statusOf(deleteLink(researcher, link.id))).toBe('ok');
  });
});

describe('comments after a demotion (integration)', () => {
  it('stop a viewer editing or deleting their earlier comments', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const researcher = await ws.addUser('researcher');
    const project = await createProject(admin, projectInput(admin.userId));
    const comment = await createComment(researcher, project.id, { body: 'original', parentId: null });
    await updateMember(admin, researcher.userId, { role: 'viewer' });
    const viewer = ws.ctxFor('viewer', { userId: researcher.userId });

    expect(await statusOf(updateComment(viewer, comment.id, 'rewritten'))).toBe(403);
    expect(await statusOf(deleteComment(viewer, comment.id))).toBe(403);
    expect(await statusOf(deleteComment(admin, comment.id))).toBe('ok'); // moderators still can
  });
});

describe('deleting a project (integration)', () => {
  it('deletes its closed experiments too, so they cannot be reopened', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const project = await createProject(admin, projectInput(admin.userId));
    const exp = await createExperiment(admin, { ...experimentInput(ws, project.id, admin.userId), status: 'in_progress' as const });
    await updateExperiment(admin, exp.id, { status: 'completed' });
    await deleteProject(admin, project.code);

    expect(await statusOf(resolveExperimentId(admin, exp.displayId))).toBe(404);
    expect((await listExperiments(admin, {})).items.some((e) => e.id === exp.id)).toBe(false);
    const [entity] = await db().select({ deletedAt: entities.deletedAt }).from(entities).where(eq(entities.id, exp.id));
    expect(entity!.deletedAt).not.toBeNull();
  });
});
