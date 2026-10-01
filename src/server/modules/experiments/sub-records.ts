import 'server-only';
import { and, eq, isNull, max } from 'drizzle-orm';
import { diffFields, hasChanges, removedFields, type FieldChanges } from '@/domain/diff';
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
import { recordEvent, type AuditAction } from '../../platform/events';
import { nextSequenceAbove } from '../../platform/sequences';
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
async function withEditable<T>(ctx: AuthContext, experimentId: string, fn: (tx: Transaction, exp: EditableExperiment) => Promise<T>): Promise<T> {
  const experiment = await loadEditableExperiment(ctx, experimentId);
  assertCanEdit(ctx, experiment);
  return db().transaction(async (tx) => {
    const result = await fn(tx, experiment);
    await touchExperiment(tx, ctx, experimentId);
    return result;
  });
}

type EditableExperiment = Awaited<ReturnType<typeof loadEditableExperiment>>;

/** Audit-only entry for a sub-record change (the feed carries new observations and results). */
function auditItem(
  tx: Transaction,
  ctx: AuthContext,
  exp: EditableExperiment,
  event: string,
  audit: { action: AuditAction; resourceType: string; resourceId: string; changes: FieldChanges | null },
) {
  return recordEvent(tx, ctx, { action: event, entityId: exp.id, projectId: exp.projectId, activity: false, audit });
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
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const where = and(eq(experimentConditions.id, itemId), eq(experimentConditions.experimentId, experimentId));
    const [before] = await tx.select({ name: experimentConditions.name, value: experimentConditions.value, unit: experimentConditions.unit, notes: experimentConditions.notes }).from(experimentConditions).where(where).limit(1);
    if (!before) throw new NotFoundError('Condition');
    const set: Record<string, unknown> = { ...input, updatedAt: new Date() };
    if (input.value !== undefined) set.numericValue = parseNumeric(input.value);
    await tx.update(experimentConditions).set(set).where(where);
    const changes = diffFields(before, input);
    if (hasChanges(changes)) await auditItem(tx, ctx, exp, 'condition.updated', { action: 'update', resourceType: 'experiment_condition', resourceId: itemId, changes });
    return { id: itemId };
  });
}

export function deleteCondition(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [removed] = await tx
      .delete(experimentConditions)
      .where(and(eq(experimentConditions.id, itemId), eq(experimentConditions.experimentId, experimentId)))
      .returning({ name: experimentConditions.name, value: experimentConditions.value, unit: experimentConditions.unit, notes: experimentConditions.notes });
    if (!removed) throw new NotFoundError('Condition');
    await auditItem(tx, ctx, exp, 'condition.deleted', { action: 'delete', resourceType: 'experiment_condition', resourceId: itemId, changes: removedFields(removed) });
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

const INPUT_AUDIT_FIELDS = {
  name: experimentInputs.name,
  inputType: experimentInputs.inputType,
  identifier: experimentInputs.identifier,
  quantity: experimentInputs.quantity,
  unit: experimentInputs.unit,
  notes: experimentInputs.notes,
};

export function updateInput(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<ExperimentInputInput>) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const where = and(eq(experimentInputs.id, itemId), eq(experimentInputs.experimentId, experimentId));
    const [before] = await tx.select(INPUT_AUDIT_FIELDS).from(experimentInputs).where(where).limit(1);
    if (!before) throw new NotFoundError('Input');
    await tx.update(experimentInputs).set({ ...input, updatedAt: new Date() }).where(where);
    const changes = diffFields(before, input);
    if (hasChanges(changes)) await auditItem(tx, ctx, exp, 'input.updated', { action: 'update', resourceType: 'experiment_input', resourceId: itemId, changes });
    return { id: itemId };
  });
}

export function deleteInput(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [removed] = await tx.delete(experimentInputs).where(and(eq(experimentInputs.id, itemId), eq(experimentInputs.experimentId, experimentId))).returning(INPUT_AUDIT_FIELDS);
    if (!removed) throw new NotFoundError('Input');
    await auditItem(tx, ctx, exp, 'input.deleted', { action: 'delete', resourceType: 'experiment_input', resourceId: itemId, changes: removedFields(removed) });
  });
}

// --- Protocol steps --------------------------------------------------------

const STEP_AUDIT_FIELDS = {
  title: experimentProtocolSteps.title,
  details: experimentProtocolSteps.details,
  durationMinutes: experimentProtocolSteps.durationMinutes,
  position: experimentProtocolSteps.position,
  completedAt: experimentProtocolSteps.completedAt,
  completedBy: experimentProtocolSteps.completedBy,
};

export function addStep(ctx: AuthContext, experimentId: string, input: StepInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [row] = await tx
      .insert(experimentProtocolSteps)
      .values({ orgId: ctx.orgId, experimentId, title: input.title, details: input.details ?? null, durationMinutes: input.durationMinutes ?? null, position: await nextPosition(tx, experimentProtocolSteps, experimentId), createdBy: ctx.userId })
      .returning({ id: experimentProtocolSteps.id });
    await auditItem(tx, ctx, exp, 'step.added', { action: 'create', resourceType: 'experiment_step', resourceId: row!.id, changes: null });
    return row!;
  });
}

export function updateStep(ctx: AuthContext, experimentId: string, itemId: string, input: Partial<StepInput> & { completed?: boolean; position?: number }) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const where = and(eq(experimentProtocolSteps.id, itemId), eq(experimentProtocolSteps.experimentId, experimentId));
    const [before] = await tx.select(STEP_AUDIT_FIELDS).from(experimentProtocolSteps).where(where).limit(1);
    if (!before) throw new NotFoundError('Step');
    const patch: Record<string, unknown> = { title: input.title, details: input.details, durationMinutes: input.durationMinutes, position: input.position };
    if (input.completed !== undefined) {
      patch.completedAt = input.completed ? new Date() : null;
      patch.completedBy = input.completed ? ctx.userId : null;
    }
    for (const key of Object.keys(patch)) if (patch[key] === undefined) delete patch[key];
    await tx.update(experimentProtocolSteps).set({ ...patch, updatedAt: new Date() }).where(where);
    const changes = diffFields(before, patch);
    if (hasChanges(changes)) await auditItem(tx, ctx, exp, 'step.updated', { action: 'update', resourceType: 'experiment_step', resourceId: itemId, changes });
    return { id: itemId };
  });
}

export function deleteStep(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const [removed] = await tx.delete(experimentProtocolSteps).where(and(eq(experimentProtocolSteps.id, itemId), eq(experimentProtocolSteps.experimentId, experimentId))).returning(STEP_AUDIT_FIELDS);
    if (!removed) throw new NotFoundError('Step');
    await auditItem(tx, ctx, exp, 'step.deleted', { action: 'delete', resourceType: 'experiment_step', resourceId: itemId, changes: removedFields(removed) });
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
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const where = and(eq(experimentObservations.id, itemId), eq(experimentObservations.experimentId, experimentId), isNull(experimentObservations.deletedAt));
    const [before] = await tx.select({ body: experimentObservations.body, significance: experimentObservations.significance, observedAt: experimentObservations.observedAt }).from(experimentObservations).where(where).limit(1);
    if (!before) throw new NotFoundError('Observation');
    const patch: Record<string, unknown> = { body: input.body, significance: input.significance };
    if (input.observedAt) patch.observedAt = new Date(input.observedAt);
    for (const key of Object.keys(patch)) if (patch[key] === undefined) delete patch[key];
    await tx.update(experimentObservations).set({ ...patch, updatedAt: new Date() }).where(where);
    const changes = diffFields(before, patch);
    if (hasChanges(changes)) await auditItem(tx, ctx, exp, 'observation.updated', { action: 'update', resourceType: 'experiment_observation', resourceId: itemId, changes });
    return { id: itemId };
  });
}

export function deleteObservation(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const rows = await tx.update(experimentObservations).set({ deletedAt: new Date() }).where(and(eq(experimentObservations.id, itemId), eq(experimentObservations.experimentId, experimentId), isNull(experimentObservations.deletedAt))).returning({ id: experimentObservations.id });
    if (rows.length === 0) throw new NotFoundError('Observation');
    await auditItem(tx, ctx, exp, 'observation.deleted', { action: 'delete', resourceType: 'experiment_observation', resourceId: itemId, changes: null });
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
  return withEditable(ctx, experimentId, async (tx, exp) => {
    if (input.sampleId) await assertSampleInOrg(tx, ctx, input.sampleId);
    const where = and(eq(experimentResults.id, itemId), eq(experimentResults.experimentId, experimentId), isNull(experimentResults.deletedAt));
    const [before] = await tx
      .select({ name: experimentResults.name, valueNumeric: experimentResults.valueNumeric, valueText: experimentResults.valueText, unit: experimentResults.unit, sampleId: experimentResults.sampleId, isKey: experimentResults.isKey, notes: experimentResults.notes })
      .from(experimentResults)
      .where(where)
      .limit(1);
    if (!before) throw new NotFoundError('Result');
    const patch: Record<string, unknown> = { ...input };
    for (const key of Object.keys(patch)) if (patch[key] === undefined) delete patch[key];
    await tx.update(experimentResults).set({ ...patch, updatedAt: new Date() }).where(where);
    const changes = diffFields(before, patch);
    if (hasChanges(changes)) await auditItem(tx, ctx, exp, 'result.updated', { action: 'update', resourceType: 'experiment_result', resourceId: itemId, changes });
    return { id: itemId };
  });
}

export function deleteResult(ctx: AuthContext, experimentId: string, itemId: string) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    const rows = await tx.update(experimentResults).set({ deletedAt: new Date() }).where(and(eq(experimentResults.id, itemId), eq(experimentResults.experimentId, experimentId), isNull(experimentResults.deletedAt))).returning({ id: experimentResults.id });
    if (rows.length === 0) throw new NotFoundError('Result');
    await auditItem(tx, ctx, exp, 'result.deleted', { action: 'delete', resourceType: 'experiment_result', resourceId: itemId, changes: null });
  });
}

// --- Samples ---------------------------------------------------------------

export function linkSample(ctx: AuthContext, experimentId: string, input: LinkSampleInput) {
  return withEditable(ctx, experimentId, async (tx, exp) => {
    let sampleId = input.sampleId ?? null;

    if (input.sample) {
      const id = crypto.randomUUID();
      const [highest] = await tx.select({ number: max(samples.number) }).from(samples).where(eq(samples.orgId, ctx.orgId));
      const number = await nextSequenceAbove(tx, ctx.orgId, 'sample', highest?.number ?? 0);
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
