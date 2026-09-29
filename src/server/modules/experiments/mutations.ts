import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { todayIn } from '@/domain/dates';
import { diffFields, hasChanges } from '@/domain/diff';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { EXPERIMENT_STATUS_META } from '@/domain/labels';
import { canDeleteExperiment, canEditExperiment } from '@/domain/permissions';
import type { CreateExperimentData, UpdateExperimentData } from '@/domain/schemas/experiments';
import { canTransitionExperiment, experimentTransitionEffects } from '@/domain/workflows';
import { actorOf, type AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db, type Transaction } from '../../db/client';
import { entityTags, experiments, experimentTypes, projects, tags, users } from '../../db/schema';
import { registerEntity, setEntityDeleted, syncEntityLabel } from '../../platform/entities';
import { recordEvent, type NotificationSpec } from '../../platform/events';
import { formatExperimentId } from '@/domain/identifiers';
import { nextSequenceValue } from '../../platform/sequences';
import { indexExperiments } from '../search/indexers';
import { getExperimentDetail, type ExperimentDetail } from './detail';

interface EditableExperiment {
  id: string;
  displayId: string;
  name: string;
  status: (typeof experiments.status.enumValues)[number];
  researcherId: string;
  createdBy: string | null;
  teamId: string | null;
  projectId: string;
  projectOwnerId: string;
  version: number;
  startDate: string | null;
  completedDate: string | null;
  blockedReason: string | null;
}

export async function loadEditableExperiment(ctx: AuthContext, experimentId: string): Promise<EditableExperiment> {
  const [row] = await db()
    .select({
      id: experiments.id,
      displayId: experiments.displayId,
      name: experiments.name,
      status: experiments.status,
      researcherId: experiments.researcherId,
      createdBy: experiments.createdBy,
      teamId: experiments.teamId,
      projectId: experiments.projectId,
      projectOwnerId: projects.ownerId,
      version: experiments.version,
      startDate: experiments.startDate,
      completedDate: experiments.completedDate,
      blockedReason: experiments.blockedReason,
    })
    .from(experiments)
    .innerJoin(projects, eq(projects.id, experiments.projectId))
    .where(and(eq(experiments.orgId, ctx.orgId), eq(experiments.id, experimentId), isNull(experiments.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('Experiment');
  return row;
}

export function assertCanEdit(ctx: AuthContext, experiment: EditableExperiment): void {
  authorize(ctx, 'experiment:update');
  if (!canEditExperiment(actorOf(ctx), { researcherId: experiment.researcherId, createdBy: experiment.createdBy, teamId: experiment.teamId })) {
    throw new ForbiddenError('You can only edit experiments you run, created, or that belong to your team');
  }
}

/** Marks the experiment active now so "stale" and feeds reflect the change. */
export async function touchExperiment(tx: Transaction, ctx: AuthContext, experimentId: string): Promise<void> {
  await tx.update(experiments).set({ lastActivityAt: new Date(), updatedAt: new Date(), updatedBy: ctx.userId }).where(eq(experiments.id, experimentId));
}

async function validateReferences(
  ctx: AuthContext,
  refs: { projectId?: string; experimentTypeId?: string; researcherId?: string },
): Promise<{ teamId: string | null } | void> {
  if (refs.projectId) {
    const [project] = await db().select({ id: projects.id, teamId: projects.teamId }).from(projects).where(and(eq(projects.id, refs.projectId), eq(projects.orgId, ctx.orgId), isNull(projects.deletedAt))).limit(1);
    if (!project) throw new ValidationError('Project is invalid', { projectId: ['Unknown project'] });
    if (refs.experimentTypeId) await validateType(ctx, refs.experimentTypeId);
    if (refs.researcherId) await validateResearcher(ctx, refs.researcherId);
    return { teamId: project.teamId };
  }
  if (refs.experimentTypeId) await validateType(ctx, refs.experimentTypeId);
  if (refs.researcherId) await validateResearcher(ctx, refs.researcherId);
}

async function validateType(ctx: AuthContext, typeId: string) {
  const [type] = await db().select({ id: experimentTypes.id }).from(experimentTypes).where(and(eq(experimentTypes.id, typeId), eq(experimentTypes.orgId, ctx.orgId))).limit(1);
  if (!type) throw new ValidationError('Experiment type is invalid', { experimentTypeId: ['Unknown experiment type'] });
}

async function validateResearcher(ctx: AuthContext, userId: string) {
  const [member] = await db().select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!member) throw new ValidationError('Researcher is invalid', { researcherId: ['Unknown user'] });
}

export async function createExperiment(ctx: AuthContext, input: CreateExperimentData): Promise<ExperimentDetail> {
  authorize(ctx, 'experiment:create');
  const project = await validateReferences(ctx, input);
  const teamId = input.teamId ?? project?.teamId ?? null;

  const experimentId = await db().transaction(async (tx) => {
    const id = crypto.randomUUID();
    const number = 1000 + (await nextSequenceValue(tx, ctx.orgId, 'experiment'));
    const displayId = formatExperimentId(number);
    const now = new Date();

    await registerEntity(tx, { id, orgId: ctx.orgId, entityType: 'experiment', displayId, title: input.name, createdBy: ctx.userId, createdAt: now });
    await tx.insert(experiments).values({
      id,
      orgId: ctx.orgId,
      number,
      displayId,
      projectId: input.projectId,
      experimentTypeId: input.experimentTypeId,
      name: input.name,
      objective: input.objective,
      hypothesis: input.hypothesis,
      researcherId: input.researcherId,
      teamId,
      status: input.status,
      priority: input.priority,
      startDate: input.status === 'in_progress' ? (input.startDate ?? todayIn(ctx.org.timezone)) : input.startDate,
      targetDate: input.targetDate,
      protocolRef: input.protocolRef,
      notes: input.notes,
      statusChangedAt: now,
      lastActivityAt: now,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    for (const tagId of input.tagIds) {
      const [tag] = await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.id, tagId), eq(tags.orgId, ctx.orgId))).limit(1);
      if (tag) await tx.insert(entityTags).values({ entityId: id, tagId, orgId: ctx.orgId, createdBy: ctx.userId }).onConflictDoNothing();
    }

    await recordEvent(tx, ctx, {
      action: 'experiment.created',
      entityId: id,
      projectId: input.projectId,
      payload: { displayId, name: input.name },
      audit: { action: 'create', resourceType: 'experiment', resourceId: id, changes: null },
      notify: input.researcherId !== ctx.userId ? [{ recipientId: input.researcherId, type: 'assignment', title: `You were assigned ${displayId}`, body: input.name }] : [],
    });
    await indexExperiments(tx, ctx.orgId, [id]);
    return id;
  });

  return getExperimentDetail(ctx, experimentId);
}

export async function updateExperiment(ctx: AuthContext, experimentId: string, input: UpdateExperimentData): Promise<ExperimentDetail> {
  const current = await loadEditableExperiment(ctx, experimentId);
  assertCanEdit(ctx, current);
  if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
    throw new ConflictError('This experiment was changed by someone else. Reload and try again.', { currentVersion: current.version });
  }
  const project = await validateReferences(ctx, input);

  const { expectedVersion: _v, status: nextStatus, ...rest } = input;
  const statusChanging = nextStatus !== undefined && nextStatus !== current.status;
  if (statusChanging && !canTransitionExperiment(current.status, nextStatus!)) {
    throw new ValidationError('Invalid status change', {
      status: [`Cannot move from ${EXPERIMENT_STATUS_META[current.status].label} to ${EXPERIMENT_STATUS_META[nextStatus!].label}`],
    });
  }

  const patch: Record<string, unknown> = { ...rest };
  if (input.teamId === undefined && input.projectId && project) patch.teamId = project.teamId;

  await db().transaction(async (tx) => {
    const now = new Date();
    if (statusChanging) {
      const effects = experimentTransitionEffects(
        { startDate: current.startDate, completedDate: current.completedDate, blockedReason: current.blockedReason },
        nextStatus!,
        todayIn(ctx.org.timezone),
      );
      Object.assign(patch, effects, { status: nextStatus, statusChangedAt: now });
    }

    const changes = diffFields(current as unknown as Record<string, unknown>, { ...patch, ...(statusChanging ? { status: nextStatus } : {}) });
    const assignmentChanged = input.researcherId !== undefined && input.researcherId !== current.researcherId;

    await tx
      .update(experiments)
      .set({ ...patch, version: current.version + 1, lastActivityAt: now, updatedAt: now, updatedBy: ctx.userId })
      .where(eq(experiments.id, experimentId));

    if (input.name && input.name !== current.name) await syncEntityLabel(tx, experimentId, { title: input.name });

    const notify: NotificationSpec[] = [];
    if (assignmentChanged && input.researcherId) {
      notify.push({ recipientId: input.researcherId, type: 'assignment', title: `You were assigned ${current.displayId}`, body: current.name });
    }

    if (statusChanging) {
      if ((nextStatus === 'failed' || (patch.blockedReason && nextStatus === undefined)) && current.projectOwnerId) {
        notify.push({ recipientId: current.projectOwnerId, type: 'status_change', title: `${current.displayId} ${EXPERIMENT_STATUS_META[nextStatus!].label.toLowerCase()}`, body: current.name });
      }
      await recordEvent(tx, ctx, {
        action: 'experiment.status_changed',
        entityId: experimentId,
        projectId: current.projectId,
        payload: { displayId: current.displayId, from: current.status, to: nextStatus, name: current.name },
        audit: { action: 'status_change', resourceType: 'experiment', resourceId: experimentId, changes },
        notify,
      });
    } else if (hasChanges(changes) || assignmentChanged) {
      await recordEvent(tx, ctx, {
        action: 'experiment.updated',
        entityId: experimentId,
        projectId: current.projectId,
        payload: { displayId: current.displayId, fields: Object.keys(changes) },
        audit: { action: 'update', resourceType: 'experiment', resourceId: experimentId, changes },
        notify,
      });
    }

    if (input.name || input.projectId) await indexExperiments(tx, ctx.orgId, [experimentId]);
  });

  // Read after the transaction commits (getExperimentDetail uses the pool, so a
  // read inside the transaction would not see the just-written row).
  return getExperimentDetail(ctx, experimentId);
}

export async function deleteExperiment(ctx: AuthContext, experimentId: string): Promise<void> {
  const current = await loadEditableExperiment(ctx, experimentId);
  authorize(ctx, 'experiment:delete');
  if (!canDeleteExperiment(actorOf(ctx), { researcherId: current.researcherId, createdBy: current.createdBy, teamId: current.teamId })) {
    throw new ForbiddenError('You can only delete experiments you run or created');
  }

  await db().transaction(async (tx) => {
    const now = new Date();
    await tx.update(experiments).set({ deletedAt: now, updatedAt: now, updatedBy: ctx.userId }).where(eq(experiments.id, experimentId));
    await setEntityDeleted(tx, experimentId, now);
    await recordEvent(tx, ctx, {
      action: 'experiment.deleted',
      entityId: experimentId,
      projectId: current.projectId,
      payload: { displayId: current.displayId, name: current.name },
      audit: { action: 'delete', resourceType: 'experiment', resourceId: experimentId, changes: null },
    });
    await indexExperiments(tx, ctx.orgId, [experimentId]);
  });
}
