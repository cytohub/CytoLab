import 'server-only';
import { and, eq, isNull, max } from 'drizzle-orm';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { formatSampleId } from '@/domain/identifiers';
import type {
  ConditionInput,
  ExperimentInputInput,
  LinkSampleInput,
  ObservationInput,
  ResultInput,
  StepInput,
} from '@/domain/schemas/experiments';
import type { AuthContext } from '../../auth/context';
import { db, type Transaction } from '../../db/client';
import {
  experimentConditions,
  experimentInputs,
  experimentObservations,
  experimentProtocolSteps,
  experimentResults,
  experimentSamples,
  samples,
} from '../../db/schema';
import { registerEntity } from '../../platform/entities';
import { recordEvent } from '../../platform/events';
import { nextSequenceValue } from '../../platform/sequences';
import { assertCanEdit, loadEditableExperiment, touchExperiment } from './mutations';

/** Parses a leading number out of a free-text value (e.g. "5", "1.0 ×10⁶" → 5, 1.0). */
function parseNumeric(value: string): number | null {
  const match = /^-?\d+(\.\d+)?/.exec(value.trim());
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

async function nextPosition(tx: Transaction, table: typeof experimentConditions | typeof experimentInputs | typeof experimentProtocolSteps, experimentId: string): Promise<number> {
  const [row] = await tx.select({ maxPos: max(table.position) }).from(table).where(eq(table.experimentId, experimentId));
  return (row?.maxPos ?? -1) + 1;
}

/** Runs a sub-record mutation with edit authorization + activity bump, in one transaction. */
async function withEditable<T>(ctx: AuthContext, experimentId: string, fn: (tx: Transaction, exp: Awaited<ReturnType<typeof loadEditableExperiment>>) => Promise<T>): Promise<T> {
  const experiment = await loadEditableExperiment(ctx, experimentId);
  assertCanEdit(ctx, experiment);
  return db().transaction(async (tx) => {
    const result = await fn(tx, experiment);
    await touchExperiment(tx, ctx, experimentId);
    return result;
  });
}

// --- Conditions ------------------------------------------------------------

export function addCondition(ctx: AuthContext, experimentId: string, input: ConditionInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [row] = await tx
      .insert(experimentConditions)
      .values({ orgId: ctx.orgId, experimentId, name: input.name, value: input.value, numericValue: parseNumeric(input.value), unit: input.unit ?? null, notes: input.notes ?? null, position: await nextPosition(tx, experimentConditions, experimentId), createdBy: ctx.userId })
      .returning({ id: experimentConditions.id });
    await recordEvent(tx, ctx, { action: 'condition.added', entityId: experimentId, projectId: exp.projectId, activity: false, audit: { action: 'create', resourceType: 'experiment_condition', resourceId: row!.id, changes: null } });
    return row!;
  });
}

export function updateCondition(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<ConditionInput>) {
  return withEditable(ctx, experimentId, async (tx) => {
    const set: Record<string, unknown> = { ...input, updatedAt: new Date() };
    if (input.value !== undefined) set.numericValue = parseNumeric(input.value);
    const rows = await tx.update(experimentConditions).set(set).where(and(eq(experimentConditions.id, itemId), eq(experimentConditions.experimentId, experimentId))).returning({ id: experimentConditions.id });
    if (rows.length === 0) throw new NotFoundError('Condition');
    return rows[0]!;
  });
}

export function deleteCondition(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx) => {
    const rows = await tx.delete(experimentConditions).where(and(eq(experimentConditions.id, itemId), eq(experimentConditions.experimentId, experimentId))).returning({ id: experimentConditions.id });
    if (rows.length === 0) throw new NotFoundError('Condition');
  });
}

// --- Inputs ----------------------------------------------------------------

export function addInput(ctx: AuthContext, experimentId: string, input: ExperimentInputInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [row] = await tx
      .insert(experimentInputs)
      .values({ orgId: ctx.orgId, experimentId, name: input.name, inputType: input.inputType, identifier: input.identifier ?? null, quantity: input.quantity ?? null, unit: input.unit ?? null, notes: input.notes ?? null, position: await nextPosition(tx, experimentInputs, experimentId), createdBy: ctx.userId })
      .returning({ id: experimentInputs.id });
    await recordEvent(tx, ctx, { action: 'input.added', entityId: experimentId, projectId: exp.projectId, activity: false, audit: { action: 'create', resourceType: 'experiment_input', resourceId: row!.id, changes: null } });
    return row!;
  });
}

export function updateInput(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<ExperimentInputInput>) {
  return withEditable(ctx, experimentId, async (tx) => {
    const rows = await tx.update(experimentInputs).set({ ...input, updatedAt: new Date() }).where(and(eq(experimentInputs.id, itemId), eq(experimentInputs.experimentId, experimentId))).returning({ id: experimentInputs.id });
    if (rows.length === 0) throw new NotFoundError('Input');
    return rows[0]!;
  });
}

export function deleteInput(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx) => {
    const rows = await tx.delete(experimentInputs).where(and(eq(experimentInputs.id, itemId), eq(experimentInputs.experimentId, experimentId))).returning({ id: experimentInputs.id });
    if (rows.length === 0) throw new NotFoundError('Input');
  });
}

// --- Protocol steps --------------------------------------------------------

export function addStep(ctx: AuthContext, experimentId: string, input: StepInput) {
  return withEditable(ctx, experimentId, async (tx) => {
    const [row] = await tx
      .insert(experimentProtocolSteps)
      .values({ orgId: ctx.orgId, experimentId, title: input.title, details: input.details ?? null, durationMinutes: input.durationMinutes ?? null, position: await nextPosition(tx, experimentProtocolSteps, experimentId), createdBy: ctx.userId })
      .returning({ id: experimentProtocolSteps.id });
    return row!;
  });
}

export function updateStep(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<StepInput> & { completed?: boolean; position?: number }) {
  return withEditable(ctx, experimentId, async (tx) => {
    const set: Record<string, unknown> = { title: input.title, details: input.details, durationMinutes: input.durationMinutes, position: input.position, updatedAt: new Date() };
    if (input.completed !== undefined) {
      set.completedAt = input.completed ? new Date() : null;
      set.completedBy = input.completed ? ctx.userId : null;
    }
    for (const key of Object.keys(set)) if (set[key] === undefined) delete set[key];
    const rows = await tx.update(experimentProtocolSteps).set(set).where(and(eq(experimentProtocolSteps.id, itemId), eq(experimentProtocolSteps.experimentId, experimentId))).returning({ id: experimentProtocolSteps.id });
    if (rows.length === 0) throw new NotFoundError('Step');
    return rows[0]!;
  });
}

export function deleteStep(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx) => {
    const rows = await tx.delete(experimentProtocolSteps).where(and(eq(experimentProtocolSteps.id, itemId), eq(experimentProtocolSteps.experimentId, experimentId))).returning({ id: experimentProtocolSteps.id });
    if (rows.length === 0) throw new NotFoundError('Step');
  });
}

// --- Observations ----------------------------------------------------------

export function addObservation(ctx: AuthContext, experimentId: string, input: ObservationInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [row] = await tx
      .insert(experimentObservations)
      .values({ orgId: ctx.orgId, experimentId, authorId: ctx.userId, body: input.body, significance: input.significance, observedAt: input.observedAt ? new Date(input.observedAt) : new Date() })
      .returning({ id: experimentObservations.id });
    await recordEvent(tx, ctx, {
      action: 'observation.recorded',
      entityId: experimentId,
      projectId: exp.projectId,
      payload: { displayId: exp.displayId, significance: input.significance },
      audit: { action: 'create', resourceType: 'experiment_observation', resourceId: row!.id, changes: null },
    });
    return row!;
  });
}

export function updateObservation(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<ObservationInput>) {
  return withEditable(ctx, experimentId, async (tx) => {
    const set: Record<string, unknown> = { body: input.body, significance: input.significance, updatedAt: new Date() };
    if (input.observedAt) set.observedAt = new Date(input.observedAt);
    for (const key of Object.keys(set)) if (set[key] === undefined) delete set[key];
    const rows = await tx.update(experimentObservations).set(set).where(and(eq(experimentObservations.id, itemId), eq(experimentObservations.experimentId, experimentId), isNull(experimentObservations.deletedAt))).returning({ id: experimentObservations.id });
    if (rows.length === 0) throw new NotFoundError('Observation');
    return rows[0]!;
  });
}

export function deleteObservation(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx) => {
    const rows = await tx.update(experimentObservations).set({ deletedAt: new Date() }).where(and(eq(experimentObservations.id, itemId), eq(experimentObservations.experimentId, experimentId), isNull(experimentObservations.deletedAt))).returning({ id: experimentObservations.id });
    if (rows.length === 0) throw new NotFoundError('Observation');
  });
}

// --- Results ---------------------------------------------------------------

async function assertSampleInOrg(tx: Transaction, ctx: AuthContext, sampleId: string) {
  const [row] = await tx.select({ id: samples.id }).from(samples).where(and(eq(samples.id, sampleId), eq(samples.orgId, ctx.orgId), isNull(samples.deletedAt))).limit(1);
  if (!row) throw new ValidationError('Sample is invalid', { sampleId: ['Unknown sample'] });
}

export function addResult(ctx: AuthContext, experimentId: string, input: ResultInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    if (input.sampleId) await assertSampleInOrg(tx, ctx, input.sampleId);
    const [row] = await tx
      .insert(experimentResults)
      .values({ orgId: ctx.orgId, experimentId, name: input.name, valueNumeric: input.valueNumeric ?? null, valueText: input.valueText ?? null, unit: input.unit ?? null, sampleId: input.sampleId ?? null, isKey: input.isKey, notes: input.notes ?? null, recordedBy: ctx.userId })
      .returning({ id: experimentResults.id });
    await recordEvent(tx, ctx, {
      action: 'result.recorded',
      entityId: experimentId,
      projectId: exp.projectId,
      payload: { displayId: exp.displayId, name: input.name, isKey: input.isKey },
      audit: { action: 'create', resourceType: 'experiment_result', resourceId: row!.id, changes: null },
    });
    return row!;
  });
}

export function updateResult(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<ResultInput> & { sampleId?: string | null }) {
  return withEditable(ctx, experimentId, async (tx) => {
    if (input.sampleId) await assertSampleInOrg(tx, ctx, input.sampleId);
    const set: Record<string, unknown> = { ...input, updatedAt: new Date() };
    for (const key of Object.keys(set)) if (set[key] === undefined) delete set[key];
    const rows = await tx.update(experimentResults).set(set).where(and(eq(experimentResults.id, itemId), eq(experimentResults.experimentId, experimentId), isNull(experimentResults.deletedAt))).returning({ id: experimentResults.id });
    if (rows.length === 0) throw new NotFoundError('Result');
    return rows[0]!;
  });
}

export function deleteResult(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx) => {
    const rows = await tx.update(experimentResults).set({ deletedAt: new Date() }).where(and(eq(experimentResults.id, itemId), eq(experimentResults.experimentId, experimentId), isNull(experimentResults.deletedAt))).returning({ id: experimentResults.id });
    if (rows.length === 0) throw new NotFoundError('Result');
  });
}

// --- Samples ---------------------------------------------------------------

export function linkSample(ctx: AuthContext, experimentId: string, input: LinkSampleInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    let sampleId = input.sampleId ?? null;

    if (input.sample) {
      const id = crypto.randomUUID();
      const number = await nextSequenceValue(tx, ctx.orgId, 'sample');
      const displayId = formatSampleId(number);
      if (input.sample.parentSampleId) await assertSampleInOrg(tx, ctx, input.sample.parentSampleId);
      await registerEntity(tx, { id, orgId: ctx.orgId, entityType: 'sample', displayId, title: input.sample.name, createdBy: ctx.userId });
      await tx.insert(samples).values({
        id,
        orgId: ctx.orgId,
        number,
        displayId,
        name: input.sample.name,
        sampleType: input.sample.sampleType,
        status: input.sample.status,
        parentSampleId: input.sample.parentSampleId,
        projectId: exp.projectId,
        quantity: input.sample.quantity,
        unit: input.sample.unit ?? null,
        storageLocation: input.sample.storageLocation ?? null,
        notes: input.sample.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      sampleId = id;
    } else if (sampleId) {
      await assertSampleInOrg(tx, ctx, sampleId);
    }

    await tx
      .insert(experimentSamples)
      .values({ experimentId, sampleId: sampleId!, orgId: ctx.orgId, role: input.role, notes: input.notes ?? null, createdBy: ctx.userId })
      .onConflictDoUpdate({ target: [experimentSamples.experimentId, experimentSamples.sampleId, experimentSamples.role], set: { notes: input.notes ?? null } });

    await recordEvent(tx, ctx, {
      action: 'sample.linked',
      entityId: experimentId,
      projectId: exp.projectId,
      payload: { displayId: exp.displayId, role: input.role },
      audit: { action: 'link', resourceType: 'experiment_sample', resourceId: sampleId, changes: null },
    });
    return { sampleId: sampleId! };
  });
}

export function unlinkSample(ctx: AuthContext, experimentId: string, sampleId: string, role: string) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const rows = await tx
      .delete(experimentSamples)
      .where(and(eq(experimentSamples.experimentId, experimentId), eq(experimentSamples.sampleId, sampleId), eq(experimentSamples.role, role as 'input' | 'output'), eq(experimentSamples.orgId, ctx.orgId)))
      .returning({ sampleId: experimentSamples.sampleId });
    if (rows.length === 0) throw new NotFoundError('Sample link');
    await recordEvent(tx, ctx, { action: 'sample.unlinked', entityId: experimentId, projectId: exp.projectId, activity: false, audit: { action: 'unlink', resourceType: 'experiment_sample', resourceId: sampleId, changes: null } });
  });
}

export { parseNumeric };
