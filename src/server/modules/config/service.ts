import 'server-only';
import { and, asc, count, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { diffFields, hasChanges } from '@/domain/diff';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type { createExperimentTypeSchema, updateExperimentTypeSchema } from '@/domain/schemas/platform';
import type { AuthContext } from '../../auth/context';

type CreateExperimentTypeSchema = z.output<typeof createExperimentTypeSchema>;
type UpdateExperimentTypeSchema = z.output<typeof updateExperimentTypeSchema>;
import { authorize } from '../../authz';
import { db } from '../../db/client';
import { isUniqueViolation } from '../../db/sql-utils';
import { experiments, experimentTypes, researchAreas } from '../../db/schema';
import { recordEvent } from '../../platform/events';
import { indexExperimentsOfType } from '../search/indexers';

export interface ExperimentTypeView {
  id: string;
  name: string;
  category: string;
  description: string | null;
  color: string;
  isActive: boolean;
  experimentCount: number;
}

export async function listExperimentTypes(ctx: AuthContext): Promise<ExperimentTypeView[]> {
  const rows = await db()
    .select({
      id: experimentTypes.id,
      name: experimentTypes.name,
      category: experimentTypes.category,
      description: experimentTypes.description,
      color: experimentTypes.color,
      isActive: experimentTypes.isActive,
      experimentCount: count(experiments.id),
    })
    .from(experimentTypes)
    .leftJoin(experiments, and(eq(experiments.experimentTypeId, experimentTypes.id)))
    .where(eq(experimentTypes.orgId, ctx.orgId))
    .groupBy(experimentTypes.id)
    .orderBy(asc(experimentTypes.category), asc(experimentTypes.name));
  return rows;
}

export async function createExperimentType(ctx: AuthContext, input: CreateExperimentTypeSchema): Promise<ExperimentTypeView> {
  authorize(ctx, 'config:manage');
  const typeId = await db()
    .transaction(async (tx) => {
      const [row] = await tx.insert(experimentTypes).values({ orgId: ctx.orgId, name: input.name, category: input.category, description: input.description, color: input.color }).returning({ id: experimentTypes.id });
      await recordEvent(tx, ctx, { action: 'experiment_type.created', entityId: null, projectId: null, activity: false, audit: { action: 'create', resourceType: 'experiment_type', resourceId: row!.id, changes: null } });
      return row!.id;
    })
    .catch((err) => {
      if (isUniqueViolation(err)) throw new ValidationError('That experiment type already exists', { name: ['Choose a different name'] });
      throw err;
    });
  return (await listExperimentTypes(ctx)).find((t) => t.id === typeId)!;
}

export async function updateExperimentType(ctx: AuthContext, typeId: string, input: UpdateExperimentTypeSchema): Promise<ExperimentTypeView> {
  authorize(ctx, 'config:manage');
  const [type] = await db()
    .select({ name: experimentTypes.name, category: experimentTypes.category, description: experimentTypes.description, color: experimentTypes.color, isActive: experimentTypes.isActive })
    .from(experimentTypes)
    .where(and(eq(experimentTypes.id, typeId), eq(experimentTypes.orgId, ctx.orgId)))
    .limit(1);
  if (!type) throw new NotFoundError('Experiment type');
  const changes = diffFields(type, input);
  await db().transaction(async (tx) => {
    await tx.update(experimentTypes).set({ ...input, updatedAt: new Date() }).where(eq(experimentTypes.id, typeId));
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'experiment_type.updated', entityId: null, projectId: null, activity: false, audit: { action: 'update', resourceType: 'experiment_type', resourceId: typeId, changes } });
    }
    if (changes.name) await indexExperimentsOfType(tx, ctx.orgId, typeId);
  });
  return (await listExperimentTypes(ctx)).find((t) => t.id === typeId)!;
}

export interface ResearchAreaView {
  id: string;
  name: string;
  color: string;
}

export async function listResearchAreas(ctx: AuthContext): Promise<ResearchAreaView[]> {
  return db().select({ id: researchAreas.id, name: researchAreas.name, color: researchAreas.color }).from(researchAreas).where(eq(researchAreas.orgId, ctx.orgId)).orderBy(asc(researchAreas.name));
}
