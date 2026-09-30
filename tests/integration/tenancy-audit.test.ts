import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { AppError } from '../../src/domain/errors';
import { closeDb, db } from '../../src/server/db/client';
import { attachments, auditLog } from '../../src/server/db/schema';
import { createSession } from '../../src/server/auth/sessions';
import { logout } from '../../src/server/modules/auth/service';
import { deleteAttachment, listAttachments } from '../../src/server/modules/collaboration/attachments';
import { createComment, createLink, createTag, deleteComment, deleteLink, setEntityTags, updateComment } from '../../src/server/modules/collaboration/service';
import { createExperimentType, updateExperimentType } from '../../src/server/modules/config/service';
import { addTeamMember, removeTeamMember, updateMember, updateProfile, updateTeam } from '../../src/server/modules/directory/service';
import { createExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import {
  addCondition,
  addResult,
  addStep,
  deleteCondition,
  deleteResult,
  deleteStep,
  updateCondition,
  updateResult,
  updateStep,
} from '../../src/server/modules/experiments/sub-records';
import { createMilestone, updateMilestone } from '../../src/server/modules/projects/milestones';
import { createProject, updateProject } from '../../src/server/modules/projects/service';
import { auditEntriesFor, createWorkspace, type TestWorkspace } from './helpers';

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
  throw new Error('expected an AppError');
}

function projectInput(ownerId: string, teamId: string | null = null) {
  return { name: 'P', code: `TA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'active' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId, startDate: null, targetDate: null, notes: null };
}

function experimentInput(ws: TestWorkspace, projectId: string, researcherId: string, teamId: string | null = null) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId, teamId, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

async function setup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const project = await createProject(admin, projectInput(admin.userId, ws.teamId));
  const experiment = await createExperiment(admin, experimentInput(ws, project.id, admin.userId));
  return { ws, admin, project, experiment };
}

async function auditOf(resourceId: string, resourceType: string) {
  return (await auditEntriesFor(resourceId)).filter((a) => a.resourceType === resourceType);
}

describe('cross-organization references (integration)', () => {
  it('rejects a project owner from another organization', async () => {
    const { admin, project } = await setup();
    const outsider = await (await createWorkspace()).addUser('scientist');

    const onCreate = await expectError(() => createProject(admin, projectInput(outsider.userId)));
    expect(onCreate.status).toBe(422);
    expect(onCreate.details?.fields).toHaveProperty('ownerId');

    const onUpdate = await expectError(() => updateProject(admin, project.code, { ownerId: outsider.userId }));
    expect(onUpdate.status).toBe(422);
  });

  it('rejects an experiment researcher or team from another organization', async () => {
    const { ws, admin, project, experiment } = await setup();
    const other = await createWorkspace();
    const outsider = await other.addUser('researcher');

    expect((await expectError(() => createExperiment(admin, experimentInput(ws, project.id, outsider.userId)))).status).toBe(422);
    expect((await expectError(() => updateExperiment(admin, experiment.id, { researcherId: outsider.userId }))).status).toBe(422);

    const foreignTeam = await expectError(() => createExperiment(admin, experimentInput(ws, project.id, admin.userId, other.teamId)));
    expect(foreignTeam.status).toBe(422);
    expect(foreignTeam.details?.fields).toHaveProperty('teamId');
    expect((await expectError(() => updateExperiment(admin, experiment.id, { teamId: other.teamId }))).status).toBe(422);
  });

  it('still accepts members of the same organization', async () => {
    const { ws, admin, project, experiment } = await setup();
    const colleague = await ws.addUser('researcher');

    const updated = await updateExperiment(admin, experiment.id, { researcherId: colleague.userId, teamId: ws.teamId });
    expect(updated.researcher?.id).toBe(colleague.userId);
    await expect(createMilestone(admin, project.id, { title: 'M', ownerId: colleague.userId })).resolves.toBeDefined();
  });

  it('rejects a milestone owner from another organization', async () => {
    const { admin, project } = await setup();
    const outsider = await (await createWorkspace()).addUser('scientist');

    expect((await expectError(() => createMilestone(admin, project.id, { title: 'M1', ownerId: outsider.userId }))).status).toBe(422);
    const milestone = await createMilestone(admin, project.id, { title: 'M2' });
    expect((await expectError(() => updateMilestone(admin, milestone.id, { ownerId: outsider.userId }))).status).toBe(422);
  });
});

describe('attachment deletion (integration)', () => {
  async function attach(ws: TestWorkspace, entityId: string, uploadedBy: string) {
    const [row] = await db()
      .insert(attachments)
      .values({ orgId: ws.orgId, entityId, fileName: 'plate-map.csv', contentType: 'text/csv', sizeBytes: 10, storageKey: `test-${crypto.randomUUID()}`, checksumSha256: '0'.repeat(64), uploadedBy })
      .returning({ id: attachments.id });
    return row!.id;
  }

  it('stops a researcher deleting a file someone else uploaded', async () => {
    const { ws, experiment } = await setup();
    const uploader = await ws.addUser('researcher');
    const other = await ws.addUser('researcher');
    const id = await attach(ws, experiment.id, uploader.userId);

    const [asOther] = await listAttachments(other, experiment.id);
    expect(asOther!.canDelete).toBe(false);
    expect((await expectError(() => deleteAttachment(other, id))).status).toBe(403);

    await deleteAttachment(uploader, id);
    expect(await listAttachments(uploader, experiment.id)).toHaveLength(0);
  });

  it('lets a lab manager delete any file', async () => {
    const { ws, experiment } = await setup();
    const uploader = await ws.addUser('researcher');
    const manager = await ws.addUser('lab_manager');
    const id = await attach(ws, experiment.id, uploader.userId);

    await deleteAttachment(manager, id);
    expect(await listAttachments(manager, experiment.id)).toHaveLength(0);
  });
});

describe('audit coverage (integration)', () => {
  it('audits sub-record edits with field diffs and keeps hard-deleted values', async () => {
    const { admin, experiment } = await setup();

    const condition = await addCondition(admin, experiment.id, { name: 'Temperature', value: '37', unit: '°C' });
    await updateCondition(admin, experiment.id, condition.id, { value: '42' });
    await deleteCondition(admin, experiment.id, condition.id);
    const conditionAudit = await auditOf(condition.id, 'experiment_condition');
    expect(conditionAudit.find((a) => a.action === 'update')?.changes).toEqual({ value: { from: '37', to: '42' } });
    expect(conditionAudit.find((a) => a.action === 'delete')?.changes).toMatchObject({ name: { from: 'Temperature', to: null }, value: { from: '42', to: null } });

    const result = await addResult(admin, experiment.id, { name: 'Viability', valueNumeric: 91.5, unit: '%' });
    await updateResult(admin, experiment.id, result.id, { valueNumeric: 88 });
    await updateResult(admin, experiment.id, result.id, { valueNumeric: 88 }); // no change, no entry
    await deleteResult(admin, experiment.id, result.id);
    const resultAudit = await auditOf(result.id, 'experiment_result');
    expect(resultAudit.map((a) => a.action).sort()).toEqual(['create', 'delete', 'update']);
    expect(resultAudit.find((a) => a.action === 'update')?.changes).toEqual({ valueNumeric: { from: 91.5, to: 88 } });

    const step = await addStep(admin, experiment.id, { title: 'Seed cells' });
    await updateStep(admin, experiment.id, step.id, { completed: true });
    await deleteStep(admin, experiment.id, step.id);
    const stepAudit = await auditOf(step.id, 'experiment_step');
    expect(stepAudit.map((a) => a.action).sort()).toEqual(['create', 'delete', 'update']);
    expect(stepAudit.find((a) => a.action === 'update')?.changes).toHaveProperty('completedBy', { from: null, to: admin.userId });
  });

  it('audits comment edits and deletes, tags, and links', async () => {
    const { ws, admin, project, experiment } = await setup();

    const comment = await createComment(admin, experiment.id, { body: 'First draft', parentId: null });
    await updateComment(admin, comment.id, 'Second draft');
    await deleteComment(admin, comment.id);
    const commentAudit = await auditOf(comment.id, 'comment');
    expect(commentAudit.find((a) => a.action === 'update')?.changes).toEqual({ body: { from: 'First draft', to: 'Second draft' } });
    expect(commentAudit.some((a) => a.action === 'delete')).toBe(true);

    const tag = await createTag(admin, { name: `qc-${ws.orgId.slice(-6)}`, color: 'slate' });
    expect((await auditOf(tag.id, 'tag')).some((a) => a.action === 'create')).toBe(true);
    await setEntityTags(admin, experiment.id, [tag.id]);
    await setEntityTags(admin, experiment.id, []);
    const tagAudit = await auditOf(experiment.id, 'entity_tags');
    expect(tagAudit.map((a) => a.changes)).toEqual(expect.arrayContaining([{ tags: { from: [], to: [tag.id] } }, { tags: { from: [tag.id], to: [] } }]));

    const link = await createLink(admin, experiment.id, { targetId: project.id, linkType: 'references' });
    await deleteLink(admin, link.id);
    const unlink = (await auditOf(link.id, 'entity_link')).find((a) => a.action === 'unlink');
    expect(unlink?.changes).toMatchObject({ targetId: { from: project.id, to: null }, linkType: { from: 'references', to: null } });
  });

  it('audits experiment types, teams, membership and profiles', async () => {
    const { ws, admin } = await setup();

    const type = await createExperimentType(admin, { name: 'Flow cytometry', category: 'Assay', description: null, color: 'blue' });
    await updateExperimentType(admin, type.id, { isActive: false });
    const typeAudit = await auditOf(type.id, 'experiment_type');
    expect(typeAudit.map((a) => a.action).sort()).toEqual(['create', 'update']);
    expect(typeAudit.find((a) => a.action === 'update')?.changes).toEqual({ isActive: { from: true, to: false } });

    await updateTeam(admin, ws.teamId, { name: 'Team B' });
    const scientist = await ws.addUser('scientist');
    await addTeamMember(admin, ws.teamId, { userId: scientist.userId, role: 'member' });
    await addTeamMember(admin, ws.teamId, { userId: scientist.userId, role: 'lead' });
    await removeTeamMember(admin, ws.teamId, scientist.userId);
    const teamAudit = await auditOf(ws.teamId, 'team');
    expect(teamAudit.find((a) => a.action === 'update')?.changes).toEqual({ name: { from: 'Team A', to: 'Team B' } });
    const membershipAudit = await auditOf(ws.teamId, 'team_membership');
    expect(membershipAudit.map((a) => a.action).sort()).toEqual(['link', 'unlink', 'update']);
    expect(membershipAudit.find((a) => a.action === 'update')?.changes).toEqual({ role: { from: 'member', to: 'lead' } });

    await updateProfile(scientist, { title: 'Senior Scientist' });
    expect((await auditOf(scientist.userId, 'user'))[0]?.changes).toEqual({ title: { from: null, to: 'Senior Scientist' } });

    await updateMember(admin, scientist.userId, { name: 'Dana Q', status: 'suspended' });
    const memberAudit = (await auditOf(scientist.userId, 'org_membership')).find((a) => a.action === 'update');
    expect(memberAudit?.changes).toEqual({ name: { from: 'scientist user', to: 'Dana Q' }, status: { from: 'active', to: 'suspended' } });
  });

  it('audits sign-out against the revoked session', async () => {
    const { ws, admin } = await setup();
    const meta = { requestId: 'test-logout', ip: '203.0.113.7', userAgent: 'vitest' };
    const session = await createSession(admin.userId, ws.orgId, meta);

    await logout(session.token, meta);
    await logout(session.token, meta); // already revoked: no second entry

    const entries = await db().select().from(auditLog).where(and(eq(auditLog.actorId, admin.userId), eq(auditLog.action, 'logout')));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ orgId: ws.orgId, resourceType: 'session' });
    expect(entries[0]!.resourceId).not.toBeNull();
  });
});
