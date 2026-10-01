import 'server-only';
import { and, eq, isNull, max } from 'drizzle-orm';
import { diffFields } from '@/domain/diff';
import { ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { canManageMilestones } from '@/domain/permissions';
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@/domain/schemas/projects';
import { actorOf, type AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db } from '../../db/client';
import { milestones, projects } from '../../db/schema';
import { recordEvent } from '../../platform/events';
import { nextSequenceAbove } from '../../platform/sequences';
import { changed, isOrgMember } from '../shared/references';

async function loadProjectForMilestone(ctx: AuthContext, projectId: string) {
  const [project] = await db()
    .select({ id: projects.id, ownerId: projects.ownerId, teamId: projects.teamId, name: projects.name })
    .from(projects)
    .where(and(eq(projects.orgId, ctx.orgId), eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);
  if (!project) throw new NotFoundError('Project');
  return project;
}

async function assertOwnerInOrg(ctx: AuthContext, ownerId: string | null | undefined) {
  if (ownerId && !(await isOrgMember(ctx, ownerId))) throw new ValidationError('Owner is invalid', { ownerId: ['Unknown user'] });
}

function assertCanManage(ctx: AuthContext, project: { ownerId: string; teamId: string | null }) {
  authorize(ctx, 'milestone:manage');
  if (!canManageMilestones(actorOf(ctx), { ownerId: project.ownerId, teamId: project.teamId })) {
    throw new ForbiddenError('You can only manage milestones on projects you own or that belong to your team');
  }
}

export async function createMilestone(ctx: AuthContext, projectId: string, input: CreateMilestoneInput) {
  const project = await loadProjectForMilestone(ctx, projectId);
  assertCanManage(ctx, project);
  await assertOwnerInOrg(ctx, input.ownerId);

  return db().transaction(async (tx) => {
    // Numbers come from a per-project counter, whose upsert row lock serializes
    // concurrent creates, kept above milestones written without it (seed data, imports).
    const [seqRow] = await tx.select({ maxSeq: max(milestones.sequence) }).from(milestones).where(eq(milestones.projectId, projectId));
    const sequence = await nextSequenceAbove(tx, ctx.orgId, `milestone:${projectId}`, seqRow?.maxSeq ?? 0);
    const [posRow] = await tx.select({ maxPos: max(milestones.position) }).from(milestones).where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)));
    const maxPos = posRow?.maxPos;
    const completed = input.status === 'completed';
    const [row] = await tx
      .insert(milestones)
      .values({
        orgId: ctx.orgId,
        projectId,
        sequence,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        status: input.status,
        completedAt: completed ? new Date() : null,
        ownerId: input.ownerId ?? null,
        position: (maxPos ?? -1) + 1,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: milestones.id, sequence: milestones.sequence });

    await recordEvent(tx, ctx, {
      action: 'milestone.created',
      entityId: projectId,
      projectId,
      payload: { milestone: `M${sequence}`, title: input.title },
      audit: { action: 'create', resourceType: 'milestone', resourceId: row!.id, changes: null },
    });
    return row!;
  });
}

export async function updateMilestone(ctx: AuthContext, milestoneId: string, input: UpdateMilestoneInput) {
  const [current] = await db()
    .select({
      id: milestones.id,
      projectId: milestones.projectId,
      sequence: milestones.sequence,
      title: milestones.title,
      description: milestones.description,
      dueDate: milestones.dueDate,
      status: milestones.status,
      ownerId: milestones.ownerId,
      position: milestones.position,
      completedAt: milestones.completedAt,
    })
    .from(milestones)
    .where(and(eq(milestones.orgId, ctx.orgId), eq(milestones.id, milestoneId), isNull(milestones.deletedAt)))
    .limit(1);
  if (!current) throw new NotFoundError('Milestone');
  const project = await loadProjectForMilestone(ctx, current.projectId);
  assertCanManage(ctx, project);
  await assertOwnerInOrg(ctx, changed(input.ownerId, current.ownerId));

  const changes = diffFields(
    { title: current.title, description: current.description, dueDate: current.dueDate, status: current.status, ownerId: current.ownerId, position: current.position },
    input,
  );

  return db().transaction(async (tx) => {
    const statusChanged = input.status !== undefined && input.status !== current.status;
    const completedAt = statusChanged ? (input.status === 'completed' ? new Date() : null) : current.completedAt;
    await tx
      .update(milestones)
      .set({ ...input, completedAt, updatedBy: ctx.userId, updatedAt: new Date() })
      .where(eq(milestones.id, milestoneId));

    if (statusChanged && input.status === 'completed') {
      await recordEvent(tx, ctx, {
        action: 'milestone.completed',
        entityId: current.projectId,
        projectId: current.projectId,
        payload: { milestone: `M${current.sequence}`, title: current.title },
        audit: { action: 'update', resourceType: 'milestone', resourceId: milestoneId, changes },
      });
    } else {
      await recordEvent(tx, ctx, {
        action: 'milestone.updated',
        entityId: current.projectId,
        projectId: current.projectId,
        activity: false,
        audit: { action: 'update', resourceType: 'milestone', resourceId: milestoneId, changes },
      });
    }
    return { id: milestoneId };
  });
}

export async function deleteMilestone(ctx: AuthContext, milestoneId: string): Promise<void> {
  const [current] = await db()
    .select({ id: milestones.id, projectId: milestones.projectId, sequence: milestones.sequence, title: milestones.title })
    .from(milestones)
    .where(and(eq(milestones.orgId, ctx.orgId), eq(milestones.id, milestoneId), isNull(milestones.deletedAt)))
    .limit(1);
  if (!current) throw new NotFoundError('Milestone');
  const project = await loadProjectForMilestone(ctx, current.projectId);
  assertCanManage(ctx, project);

  await db().transaction(async (tx) => {
    await tx.update(milestones).set({ deletedAt: new Date(), updatedBy: ctx.userId }).where(eq(milestones.id, milestoneId));
    await recordEvent(tx, ctx, {
      action: 'milestone.deleted',
      entityId: current.projectId,
      projectId: current.projectId,
      activity: false,
      audit: { action: 'delete', resourceType: 'milestone', resourceId: milestoneId, changes: null },
    });
  });
}
