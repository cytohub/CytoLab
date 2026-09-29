import { z } from 'zod';
import {
  EXPERIMENT_SAMPLE_ROLES,
  EXPERIMENT_STATUSES,
  INPUT_TYPES,
  OBSERVATION_SIGNIFICANCE,
  PRIORITIES,
  SAMPLE_STATUSES,
} from '../enums';
import {
  csv,
  dateOnly,
  expectedVersion,
  optionalText,
  pageParams,
  queryBoolean,
  requiredText,
  searchText,
  sortParam,
  uuid,
} from './common';

const nullableDate = dateOnly.nullish().transform((v) => v ?? null);
const datesInOrder = (v: { startDate?: string | null; targetDate?: string | null }) =>
  !v.startDate || !v.targetDate || v.targetDate >= v.startDate;
const datesError = { error: 'Target date must be on or after the start date', path: ['targetDate'] };

export const createExperimentSchema = z
  .object({
    projectId: uuid,
    experimentTypeId: uuid,
    name: requiredText(200, 'Name'),
    objective: optionalText(5_000),
    hypothesis: optionalText(5_000),
    researcherId: uuid,
    /** Defaults to the project's team when omitted. */
    teamId: uuid.nullish(),
    status: z.enum(['planned', 'in_progress'] as const).default('planned'),
    priority: z.enum(PRIORITIES).default('medium'),
    startDate: nullableDate,
    targetDate: nullableDate,
    protocolRef: optionalText(200),
    notes: optionalText(50_000),
    tagIds: z.array(uuid).max(20).default([]),
  })
  .refine(datesInOrder, datesError);
export type CreateExperimentInput = z.input<typeof createExperimentSchema>;
export type CreateExperimentData = z.output<typeof createExperimentSchema>;

export const updateExperimentSchema = z
  .object({
    projectId: uuid.optional(),
    experimentTypeId: uuid.optional(),
    name: requiredText(200, 'Name').optional(),
    objective: optionalText(5_000).optional(),
    hypothesis: optionalText(5_000).optional(),
    researcherId: uuid.optional(),
    teamId: uuid.nullable().optional(),
    status: z.enum(EXPERIMENT_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    startDate: dateOnly.nullable().optional(),
    targetDate: dateOnly.nullable().optional(),
    completedDate: dateOnly.nullable().optional(),
    protocolRef: optionalText(200).optional(),
    blockedReason: optionalText(500).optional(),
    resultsSummary: optionalText(20_000).optional(),
    conclusion: optionalText(20_000).optional(),
    notes: optionalText(50_000).optional(),
    expectedVersion,
  })
  .refine(datesInOrder, datesError);
export type UpdateExperimentInput = z.input<typeof updateExperimentSchema>;
export type UpdateExperimentData = z.output<typeof updateExperimentSchema>;

export const EXPERIMENT_SORT_FIELDS = [
  'number',
  'name',
  'status',
  'priority',
  'startDate',
  'targetDate',
  'completedDate',
  'createdAt',
  'updatedAt',
] as const;

export const listExperimentsQuerySchema = z.object({
  q: searchText,
  status: csv(z.enum(EXPERIMENT_STATUSES)),
  projectId: csv(uuid),
  researcherId: csv(uuid),
  typeId: csv(uuid),
  teamId: csv(uuid),
  tagId: csv(uuid),
  startFrom: dateOnly.optional(),
  startTo: dateOnly.optional(),
  completedFrom: dateOnly.optional(),
  completedTo: dateOnly.optional(),
  attention: queryBoolean,
  sort: sortParam(EXPERIMENT_SORT_FIELDS, '-updatedAt'),
  ...pageParams,
});
export type ListExperimentsQuery = z.output<typeof listExperimentsQuerySchema>;

// ---------------------------------------------------------------------------
// Structured sub-records
// ---------------------------------------------------------------------------

export const conditionSchema = z.object({
  name: requiredText(120, 'Parameter'),
  value: requiredText(200, 'Value'),
  unit: optionalText(40),
  notes: optionalText(1_000),
});
export const updateConditionSchema = conditionSchema.partial();
export type ConditionInput = z.input<typeof conditionSchema>;

export const inputSchema = z.object({
  name: requiredText(200, 'Name'),
  inputType: z.enum(INPUT_TYPES).default('reagent'),
  identifier: optionalText(120),
  quantity: z.number().nonnegative().nullish().transform((v) => v ?? null),
  unit: optionalText(40),
  notes: optionalText(1_000),
});
export const updateInputSchema = inputSchema.partial();
export type ExperimentInputInput = z.input<typeof inputSchema>;

export const stepSchema = z.object({
  title: requiredText(300, 'Step'),
  details: optionalText(5_000),
  durationMinutes: z.number().int().min(0).max(100_000).nullish().transform((v) => v ?? null),
});
export const updateStepSchema = stepSchema.partial().extend({
  completed: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});
export type StepInput = z.input<typeof stepSchema>;

export const observationSchema = z.object({
  body: requiredText(10_000, 'Observation'),
  significance: z.enum(OBSERVATION_SIGNIFICANCE).default('routine'),
  observedAt: z.iso.datetime({ offset: true }).optional(),
});
export const updateObservationSchema = observationSchema.partial();
export type ObservationInput = z.input<typeof observationSchema>;

export const resultSchema = z
  .object({
    name: requiredText(200, 'Measurement'),
    valueNumeric: z.number().finite().nullish().transform((v) => v ?? null),
    valueText: optionalText(2_000),
    unit: optionalText(40),
    sampleId: uuid.nullish().transform((v) => v ?? null),
    isKey: z.boolean().default(false),
    notes: optionalText(2_000),
  })
  .refine((v) => v.valueNumeric !== null || v.valueText !== null, {
    error: 'Provide a numeric value or a text result',
    path: ['valueNumeric'],
  });
export const updateResultSchema = z.object({
  name: requiredText(200, 'Measurement').optional(),
  valueNumeric: z.number().finite().nullable().optional(),
  valueText: optionalText(2_000).optional(),
  unit: optionalText(40).optional(),
  sampleId: uuid.nullable().optional(),
  isKey: z.boolean().optional(),
  notes: optionalText(2_000).optional(),
});
export type ResultInput = z.input<typeof resultSchema>;

export const newSampleSchema = z.object({
  name: requiredText(200, 'Sample name'),
  sampleType: requiredText(80, 'Sample type'),
  status: z.enum(SAMPLE_STATUSES).default('available'),
  parentSampleId: uuid.nullish().transform((v) => v ?? null),
  quantity: z.number().nonnegative().nullish().transform((v) => v ?? null),
  unit: optionalText(40),
  storageLocation: optionalText(200),
  notes: optionalText(2_000),
});
export type NewSampleInput = z.input<typeof newSampleSchema>;

/** Link an existing sample or register a new one, in a single call. */
export const linkSampleSchema = z
  .object({
    role: z.enum(EXPERIMENT_SAMPLE_ROLES).default('input'),
    sampleId: uuid.optional(),
    sample: newSampleSchema.optional(),
    notes: optionalText(1_000),
  })
  .refine((v) => Boolean(v.sampleId) !== Boolean(v.sample), {
    error: 'Provide either an existing sample or a new sample',
    path: ['sampleId'],
  });
export type LinkSampleInput = z.input<typeof linkSampleSchema>;
