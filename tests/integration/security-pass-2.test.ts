import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { activityQuerySchema } from '../../src/domain/schemas/platform';
import type { AuthContext } from '../../src/server/auth/context';
import { createSession, resolveSession, SESSION_MAX_AGE_MS } from '../../src/server/auth/sessions';
import { closeDb, db } from '../../src/server/db/client';
import { notifications, sessions } from '../../src/server/db/schema';
import { listActivity } from '../../src/server/modules/activity/service';
import { assertCanUpload, createAttachment, deleteAttachment } from '../../src/server/modules/collaboration/attachments';
import { createComment, deleteComment, updateComment } from '../../src/server/modules/collaboration/service';
import { addTeamMember, updateMember } from '../../src/server/modules/directory/service';
import { createExperiment, deleteExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import { createProject } from '../../src/server/modules/projects/service';
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

const meta = { requestId: 'test', ip: '192.0.2.10', userAgent: 'vitest' };

async function setup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const owner = await ws.addUser('scientist');
  const researcher = await ws.addUser('researcher');
  const project = await createProject(owner, { name: 'P', code: `SP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId: owner.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });
  const experiment = await createExperiment(admin, experimentInput(ws, project.id, researcher.userId));
  return { ws, admin, owner, researcher, project, experiment };
}

function experimentInput(ws: TestWorkspace, projectId: string, researcherId: string) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Stability run', objective: null, hypothesis: null, researcherId, teamId: null, status: 'in_progress' as const, priority: 'medium' as const, startDate: '2026-01-10', targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

describe('file uploads (integration)', () => {
  it('need edit rights on the record, as tags and links do', async () => {
    const { ws, researcher, project, experiment } = await setup();
    const outsider = await ws.addUser('researcher');
    expect(await statusOf(assertCanUpload(outsider, experiment.id))).toBe(403);
    expect(await statusOf(assertCanUpload(researcher, project.id))).toBe(403); // researchers can't edit projects
    expect(await statusOf(assertCanUpload(researcher, experiment.id))).toBe('ok');
  });
});

describe('team membership (integration)', () => {
  it('admits only active members', async () => {
    const { ws, admin } = await setup();
    const suspended = await ws.addUser('scientist');
    await updateMember(admin, suspended.userId, { status: 'suspended' });
    expect(await statusOf(addTeamMember(admin, ws.teamId, { userId: suspended.userId, role: 'member' }))).toBe(422);
  });
});

describe('deleted records (integration)', () => {
  it('keep their comments and files as they were', async () => {
    const { admin, researcher, experiment } = await setup();
    const comment = await createComment(researcher, experiment.id, { body: 'Seal looked loose', parentId: null });
    const file = await createAttachment(researcher, experiment.id, { fileName: 'plate.csv', contentType: 'text/csv', data: new Uint8Array([1, 2, 3]) });
    await deleteExperiment(admin, experiment.id);

    expect(await statusOf(updateComment(researcher, comment.id, 'Rewritten'))).toBe(404);
    expect(await statusOf(deleteComment(researcher, comment.id))).toBe(404);
    expect(await statusOf(deleteAttachment(researcher, file.id))).toBe(404);
  });
});

describe('sessions (integration)', () => {
  it('end when a member is suspended, so reactivation does not revive them', async () => {
    const { ws, admin } = await setup();
    const member = await ws.addUser('scientist');
    const { token } = await createSession(member.userId, ws.orgId, meta);
    expect(await resolveSession(token, meta)).not.toBeNull();

    await updateMember(admin, member.userId, { status: 'suspended' });
    await updateMember(admin, member.userId, { status: 'active' });
    expect(await resolveSession(token, meta)).toBeNull();
  });

  it('end 30 days after sign-in however active they stay', async () => {
    const { ws } = await setup();
    const member = await ws.addUser('scientist');
    const { token } = await createSession(member.userId, ws.orgId, meta);
    await db().update(sessions).set({ createdAt: new Date(Date.now() - SESSION_MAX_AGE_MS - 60_000) }).where(eq(sessions.userId, member.userId));
    expect(await resolveSession(token, meta)).toBeNull();
  });
});

describe('activity filter (integration)', () => {
  it('matches the action namespace literally', async () => {
    const { admin } = await setup();
    const all = await listActivity(admin, activityQuerySchema.parse({ action: 'experiment' }));
    expect(all.items.length).toBeGreaterThan(0);
    // "experiment" is 10 characters; unescaped, ten underscores matched it.
    const wildcard = await listActivity(admin, activityQuerySchema.parse({ action: '__________' }));
    expect(wildcard.items).toHaveLength(0);
  });
});

describe('completion dates and blockers (integration)', () => {
  async function save(ctx: AuthContext, id: string, input: Record<string, unknown>) {
    const { getExperimentDetail } = await import('../../src/server/modules/experiments/detail');
    const { version } = await getExperimentDetail(ctx, id);
    return updateExperiment(ctx, id, { ...input, expectedVersion: version });
  }

  it('refuses a completion date on unfinished work, before the start, or in the future', async () => {
    const { researcher, experiment } = await setup();
    expect(await statusOf(save(researcher, experiment.id, { completedDate: '2026-01-20' }))).toBe(422);

    await save(researcher, experiment.id, { status: 'completed' });
    expect(await statusOf(save(researcher, experiment.id, { completedDate: '2026-01-01' }))).toBe(422);
    expect(await statusOf(save(researcher, experiment.id, { completedDate: '2200-01-01' }))).toBe(422);
    expect(await statusOf(save(researcher, experiment.id, { completedDate: '2026-01-20' }))).toBe('ok');
    expect(await statusOf(save(researcher, experiment.id, { blockedReason: 'Waiting on reagent' }))).toBe(422);
  });

  it('tells the project owner when an experiment is blocked', async () => {
    const { owner, researcher, experiment } = await setup();
    await save(researcher, experiment.id, { status: 'in_progress', blockedReason: 'Incubator down' });
    const rows = await db().select({ title: notifications.title }).from(notifications).where(and(eq(notifications.recipientId, owner.userId), eq(notifications.entityId, experiment.id)));
    expect(rows.map((r) => r.title)).toEqual([`${experiment.displayId} blocked`]);
  });
});
