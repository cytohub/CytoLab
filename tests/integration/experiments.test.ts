import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { AppError } from '../../src/domain/errors';
import { evaluateAttention } from '../../src/domain/attention';
import { dateOf, todayIn } from '../../src/domain/dates';
import { closeDb, db } from '../../src/server/db/client';
import { experiments } from '../../src/server/db/schema';
import { attentionCondition } from '../../src/server/modules/experiments/attention-sql';
import { createProject } from '../../src/server/modules/projects/service';
import { getExperimentDetail } from '../../src/server/modules/experiments/detail';
import { createExperiment, updateExperiment } from '../../src/server/modules/experiments/mutations';
import { addObservation, addResult } from '../../src/server/modules/experiments/sub-records';
import { listExperiments } from '../../src/server/modules/experiments/service';
import { auditEntriesFor, createWorkspace, type TestWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function setup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const project = await createProject(admin, { name: 'P', code: `PX-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, ownerId: admin.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: ws.teamId, startDate: null, targetDate: null, notes: null });
  return { ws, admin, projectId: project.id };
}

function newExperiment(ws: TestWorkspace, projectId: string, researcherId: string) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId, teamId: null, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('expected an AppError');
}

describe('experiments service (integration)', () => {
  it('allocates sequential display IDs per organization', async () => {
    const { ws, admin, projectId } = await setup();
    const e1 = await createExperiment(admin, newExperiment(ws, projectId, admin.userId));
    const e2 = await createExperiment(admin, newExperiment(ws, projectId, admin.userId));
    expect(e2.displayId).not.toBe(e1.displayId);
    expect(Number(e2.displayId.split('-')[1])).toBe(Number(e1.displayId.split('-')[1]) + 1);
  });

  it('runs the status machine, applying transition effects and rejecting invalid moves', async () => {
    const { ws, admin, projectId } = await setup();
    const exp = await createExperiment(admin, newExperiment(ws, projectId, admin.userId));

    const started = await updateExperiment(admin, exp.id, { status: 'in_progress' });
    expect(started.status.value).toBe('in_progress');
    expect(started.startDate).not.toBeNull(); // start date auto-filled

    const completed = await updateExperiment(admin, exp.id, { status: 'completed' });
    expect(completed.completedDate).not.toBeNull();

    const err = await expectError(() => updateExperiment(admin, exp.id, { status: 'planned' }));
    // completed → planned is not allowed
    expect(err.status).toBe(422);
  });

  it('records activity + audit and notifies the assignee on creation', async () => {
    const { ws, admin, projectId } = await setup();
    const researcher = await ws.addUser('researcher');
    const exp = await createExperiment(admin, newExperiment(ws, projectId, researcher.userId));

    const audits = await auditEntriesFor(exp.id);
    expect(audits.some((a) => a.action === 'create')).toBe(true);

    const { notifications } = await import('../../src/server/db/schema');
    const notifs = await db().select().from(notifications).where(eq(notifications.recipientId, researcher.userId));
    expect(notifs.some((n) => n.type === 'assignment')).toBe(true);
  });

  it('bumps last activity when a sub-record is added', async () => {
    const { ws, admin, projectId } = await setup();
    const exp = await createExperiment(admin, { ...newExperiment(ws, projectId, admin.userId), status: 'in_progress' });
    const [before] = await db().select({ ts: experiments.lastActivityAt }).from(experiments).where(eq(experiments.id, exp.id));
    await new Promise((r) => setTimeout(r, 10));

    await addObservation(admin, exp.id, { body: 'Observed something', significance: 'notable' });
    await addResult(admin, exp.id, { name: 'Yield', valueNumeric: 42, valueText: null, unit: '%', isKey: true, sampleId: null, notes: null });

    const detail = await getExperimentDetail(admin, exp.id);
    expect(detail.counts.observations).toBe(1);
    expect(detail.results.find((r) => r.isKey)?.valueNumeric).toBe(42);

    const [after] = await db().select({ ts: experiments.lastActivityAt }).from(experiments).where(eq(experiments.id, exp.id));
    expect(after!.ts.getTime()).toBeGreaterThan(before!.ts.getTime());
  });

  it('keeps the SQL attention filter in agreement with the domain rule', async () => {
    const { ws, admin, projectId } = await setup();
    // Create a spread of experiments in different states.
    const blocked = await createExperiment(admin, { ...newExperiment(ws, projectId, admin.userId), status: 'in_progress' });
    await updateExperiment(admin, blocked.id, { blockedReason: 'stuck' });
    const overdue = await createExperiment(admin, { ...newExperiment(ws, projectId, admin.userId), status: 'in_progress', startDate: '2019-12-01', targetDate: '2020-01-01' });
    await createExperiment(admin, { ...newExperiment(ws, projectId, admin.userId), status: 'planned', targetDate: '2099-01-01' }); // fine

    const today = todayIn(ws.timezone);
    const now = new Date();

    // SQL-side set.
    const sqlRows = await db().select({ id: experiments.id }).from(experiments).where(and(eq(experiments.orgId, ws.orgId), attentionCondition(today, now)));
    const sqlIds = new Set(sqlRows.map((r) => r.id));

    // Domain-side set over the same rows.
    const all = await db().select().from(experiments).where(eq(experiments.orgId, ws.orgId));
    const domainIds = new Set(
      all
        .filter((row) => {
          const reasons = evaluateAttention(
            { status: row.status, startDate: row.startDate, targetDate: row.targetDate, blockedReason: row.blockedReason, lastActivityDate: dateOf(row.lastActivityAt, ws.timezone), statusChangedDate: dateOf(row.statusChangedAt, ws.timezone) },
            today,
          );
          return reasons.length > 0;
        })
        .map((r) => r.id),
    );

    expect(sqlIds).toEqual(domainIds);
    expect(sqlIds.has(blocked.id)).toBe(true);
    expect(sqlIds.has(overdue.id)).toBe(true);

    const filtered = await listExperiments(admin, { attention: true });
    expect(new Set(filtered.items.map((i) => i.id))).toEqual(domainIds);
  });
});
