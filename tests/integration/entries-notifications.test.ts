import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import type { AuthContext } from '../../src/server/auth/context';
import { closeDb, db } from '../../src/server/db/client';
import { notifications } from '../../src/server/db/schema';
import { getExperimentDetail } from '../../src/server/modules/experiments/detail';
import { createExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import { addObservation, addResult, deleteObservation, deleteResult, updateObservation, updateResult } from '../../src/server/modules/experiments/sub-records';
import { markNotifications } from '../../src/server/modules/notifications/service';
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

async function setup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const researcher = await ws.addUser('researcher');
  const teammate = await ws.addUser('scientist', [ws.teamId]); // edits the team's experiments
  const manager = await ws.addUser('lab_manager');
  const project = await createProject(admin, { name: 'P', code: `EN-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId: admin.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: ws.teamId, startDate: null, targetDate: null, notes: null });
  const experiment = await createExperiment(admin, experimentInput(ws, project.id, researcher.userId));
  return { ws, admin, researcher, teammate, manager, project, experiment };
}

function experimentInput(ws: TestWorkspace, projectId: string, researcherId: string) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Binding assay', objective: null, hypothesis: null, researcherId, teamId: ws.teamId, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

describe('observation and result authorship (integration)', () => {
  it('lets only the author or a lab manager change an observation', async () => {
    const { researcher, teammate, manager, experiment } = await setup();
    const { id } = await addObservation(researcher, experiment.id, { body: 'Cells confluent at 48 h', significance: 'routine' });

    expect(await statusOf(updateObservation(teammate, experiment.id, id, { body: 'Rewritten' }))).toBe(403);
    expect(await statusOf(deleteObservation(teammate, experiment.id, id))).toBe(403);
    expect(await statusOf(updateObservation(manager, experiment.id, id, { body: 'Cells confluent at 48 h (corrected)' }))).toBe('ok');
    expect(await statusOf(deleteObservation(researcher, experiment.id, id))).toBe('ok');
  });

  it('lets only the author or a lab manager change a result', async () => {
    const { researcher, teammate, manager, experiment } = await setup();
    const { id } = await addResult(teammate, experiment.id, { name: 'Kd', valueNumeric: 4.2, unit: 'nM', isKey: false });

    expect(await statusOf(updateResult(researcher, experiment.id, id, { valueNumeric: 1 }))).toBe(403);
    expect(await statusOf(deleteResult(researcher, experiment.id, id))).toBe(403);
    expect(await statusOf(updateResult(teammate, experiment.id, id, { valueNumeric: 4.3 }))).toBe('ok');
    expect(await statusOf(deleteResult(manager, experiment.id, id))).toBe('ok');
  });

  it('shows the delete control only where it will work', async () => {
    const { researcher, teammate, experiment } = await setup();
    await addObservation(researcher, experiment.id, { body: 'Mine', significance: 'routine' });
    await addResult(teammate, experiment.id, { name: 'Theirs', valueNumeric: 1, isKey: false });

    const forResearcher = await getExperimentDetail(researcher, experiment.id);
    expect(forResearcher.observations.map((o) => o.canModify)).toEqual([true]);
    expect(forResearcher.results.map((r) => r.canModify)).toEqual([false]);
  });
});

describe('notification merging (integration)', () => {
  async function assignmentsFor(ctx: AuthContext, entityId: string) {
    return db()
      .select({ title: notifications.title, readAt: notifications.readAt })
      .from(notifications)
      .where(and(eq(notifications.recipientId, ctx.userId), eq(notifications.entityId, entityId), eq(notifications.type, 'assignment')));
  }

  it('updates an unread assignment instead of adding another, and notifies again once it is read', async () => {
    const { ws, admin, researcher, experiment } = await setup();
    const other = await ws.addUser('researcher');

    let version = experiment.version;
    const assign = async (to: AuthContext) => {
      version = (await updateExperiment(admin, experiment.id, { researcherId: to.userId, expectedVersion: version })).version;
    };

    await assign(other);
    await assign(researcher);
    await assign(other);
    await assign(researcher);
    expect(await assignmentsFor(researcher, experiment.id)).toHaveLength(1);
    expect(await assignmentsFor(other, experiment.id)).toHaveLength(1);

    await markNotifications(researcher, { all: true });
    await assign(other);
    await assign(researcher);
    const after = await assignmentsFor(researcher, experiment.id);
    expect(after).toHaveLength(2);
    expect(after.filter((n) => n.readAt === null)).toHaveLength(1);
  });

  it('keeps notifications about different records apart', async () => {
    const { ws, admin, researcher, project } = await setup();
    const second = await createExperiment(admin, experimentInput(ws, project.id, researcher.userId));
    const unread = await db()
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.recipientId, researcher.userId), eq(notifications.type, 'assignment'), isNull(notifications.readAt)));
    expect(unread).toHaveLength(2);
    expect(second.id).toBeTruthy();
  });
});
