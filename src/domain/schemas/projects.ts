import { z } from 'zod';
import { MILESTONE_STATUSES, PRIORITIES, PROJECT_STATUSES } from '../enums';
import { isValidProjectCode } from '../identifiers';
import {
  csv,
  dateOnly,
  expectedVersion,
  optionalText,
  pageParams,
  requiredText,
  searchText,
  sortParam,
  uuid,
} from './common';

export const projectCode = z
  .string({ error: 'Project code is required' })
  .trim()
  .transform((v) => v.toUpperCase())
  .refine(isValidProjectCode, {
    error: 'Use 2–24 uppercase letters or digits in dash-separated groups (e.g. CART-001)',
  });

const datesInOrder = (v: { startDate?: string | null; targetDate?: string | null }) =>
  !v.startDate || !v.targetDate || v.targetDate >= v.startDate;
const datesError = { error: 'Target date must be on or after the start date', path: ['targetDate'] };

export const createProjectSchema = z
  .object({
    name: requiredText(160, 'Name'),
    code: projectCode,
    description: optionalText(10_000),
    researchAreaId: uuid.nullish().transform((v) => v ?? null),
    ownerId: uuid,
    teamId: uuid.nullish().transform((v) => v ?? null),
    status: z.enum(PROJECT_STATUSES).default('planning'),
    priority: z.enum(PRIORITIES).default('medium'),
    startDate: dateOnly.nullish().transform((v) => v ?? null),
    targetDate: dateOnly.nullish().transform((v) => v ?? null),
    notes: optionalText(50_000),
  })
  .refine(datesInOrder, datesError);
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateProjectData = z.output<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: requiredText(160, 'Name').optional(),
    code: projectCode.optional(),
    description: optionalText(10_000).optional(),
    researchAreaId: uuid.nullable().optional(),
    ownerId: uuid.optional(),
    teamId: uuid.nullable().optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    startDate: dateOnly.nullable().optional(),
    targetDate: dateOnly.nullable().optional(),
    notes: optionalText(50_000).optional(),
    expectedVersion,
  })
  .refine(datesInOrder, datesError);
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type UpdateProjectData = z.output<typeof updateProjectSchema>;

export const PROJECT_SORT_FIELDS = ['name', 'code', 'status', 'priority', 'targetDate', 'startDate', 'updatedAt'] as const;

export const listProjectsQuerySchema = z.object({
  q: searchText,
  status: csv(z.enum(PROJECT_STATUSES)),
  teamId: csv(uuid),
  ownerId: csv(uuid),
  researchAreaId: csv(uuid),
  sort: sortParam(PROJECT_SORT_FIELDS, '-updatedAt'),
  ...pageParams,
});
export type ListProjectsQuery = z.output<typeof listProjectsQuerySchema>;

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export const createMilestoneSchema = z.object({
  title: requiredText(200, 'Title'),
  description: optionalText(5_000),
  dueDate: dateOnly.nullish().transform((v) => v ?? null),
  status: z.enum(MILESTONE_STATUSES).default('pending'),
  ownerId: uuid.nullish().transform((v) => v ?? null),
});
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  title: requiredText(200, 'Title').optional(),
  description: optionalText(5_000).optional(),
  dueDate: dateOnly.nullable().optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
  ownerId: uuid.nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;
