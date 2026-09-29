import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  createdAt,
  deletedAt,
  experimentSampleRoleEnum,
  experimentStatusEnum,
  inputTypeEnum,
  milestoneStatusEnum,
  observationSignificanceEnum,
  primaryId,
  priorityEnum,
  projectStatusEnum,
  sampleStatusEnum,
  timestamptz,
  updatedAt,
} from './_shared';
import { entities } from './entities';
import { organizations, teams, users } from './identity';

const orgId = () =>
  uuid('org_id')
    .notNull()
    .references(() => organizations.id);
const createdBy = () => uuid('created_by').references(() => users.id);
const updatedBy = () => uuid('updated_by').references(() => users.id);
const dateOnly = (name: string) => date(name, { mode: 'string' });

export const researchAreas = pgTable(
  'research_areas',
  {
    id: primaryId(),
    orgId: orgId(),
    name: text('name').notNull(),
    color: text('color').notNull().default('slate'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('research_areas_org_name_unique').on(t.orgId, sql`lower(${t.name})`)],
);

// ---------------------------------------------------------------------------
// Projects & milestones
// ---------------------------------------------------------------------------

export const projects = pgTable(
  'projects',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => entities.id, { onDelete: 'cascade' }),
    orgId: orgId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    researchAreaId: uuid('research_area_id').references(() => researchAreas.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    teamId: uuid('team_id').references(() => teams.id),
    status: projectStatusEnum('status').notNull().default('planning'),
    priority: priorityEnum('priority').notNull().default('medium'),
    startDate: dateOnly('start_date'),
    targetDate: dateOnly('target_date'),
    completedAt: timestamptz('completed_at'),
    notes: text('notes'),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('projects_org_code_unique')
      .on(t.orgId, sql`upper(${t.code})`)
      .where(sql`${t.deletedAt} is null`),
    index('projects_org_status_idx').on(t.orgId, t.status).where(sql`${t.deletedAt} is null`),
    index('projects_org_owner_idx').on(t.orgId, t.ownerId),
    index('projects_org_team_idx').on(t.orgId, t.teamId),
    index('projects_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    check('projects_dates_ordered', sql`${t.targetDate} is null or ${t.startDate} is null or ${t.targetDate} >= ${t.startDate}`),
  ],
);

export const milestones = pgTable(
  'milestones',
  {
    id: primaryId(),
    orgId: orgId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Per-project sequence rendered as M1, M2, … */
    sequence: integer('sequence').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: dateOnly('due_date'),
    status: milestoneStatusEnum('status').notNull().default('pending'),
    completedAt: timestamptz('completed_at'),
    ownerId: uuid('owner_id').references(() => users.id),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('milestones_project_sequence_unique').on(t.projectId, t.sequence),
    index('milestones_org_due_idx')
      .on(t.orgId, t.dueDate)
      .where(sql`${t.deletedAt} is null and ${t.status} in ('pending', 'in_progress')`),
  ],
);

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------

export const experimentTypes = pgTable(
  'experiment_types',
  {
    id: primaryId(),
    orgId: orgId(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    color: text('color').notNull().default('blue'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('experiment_types_org_name_unique').on(t.orgId, sql`lower(${t.name})`)],
);

export const experiments = pgTable(
  'experiments',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => entities.id, { onDelete: 'cascade' }),
    orgId: orgId(),
    number: integer('number').notNull(),
    displayId: text('display_id').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    experimentTypeId: uuid('experiment_type_id')
      .notNull()
      .references(() => experimentTypes.id),
    name: text('name').notNull(),
    objective: text('objective'),
    hypothesis: text('hypothesis'),
    researcherId: uuid('researcher_id')
      .notNull()
      .references(() => users.id),
    teamId: uuid('team_id').references(() => teams.id),
    status: experimentStatusEnum('status').notNull().default('planned'),
    priority: priorityEnum('priority').notNull().default('medium'),
    startDate: dateOnly('start_date'),
    targetDate: dateOnly('target_date'),
    completedDate: dateOnly('completed_date'),
    /** Free-text protocol reference until the protocol library ships (→ protocol_version_id). */
    protocolRef: text('protocol_ref'),
    blockedReason: text('blocked_reason'),
    resultsSummary: text('results_summary'),
    conclusion: text('conclusion'),
    notes: text('notes'),
    statusChangedAt: timestamptz('status_changed_at').notNull().defaultNow(),
    /** Bumped by any change to the experiment or its sub-records (drives "stale"). */
    lastActivityAt: timestamptz('last_activity_at').notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('experiments_org_number_unique').on(t.orgId, t.number),
    index('experiments_org_status_idx').on(t.orgId, t.status).where(sql`${t.deletedAt} is null`),
    index('experiments_project_status_idx').on(t.projectId, t.status),
    index('experiments_org_researcher_idx').on(t.orgId, t.researcherId),
    index('experiments_org_type_idx').on(t.orgId, t.experimentTypeId),
    index('experiments_org_updated_idx').on(t.orgId, t.updatedAt.desc()),
    index('experiments_org_completed_idx').on(t.orgId, t.completedDate),
    index('experiments_org_target_open_idx')
      .on(t.orgId, t.targetDate)
      .where(sql`${t.deletedAt} is null and ${t.status} in ('planned', 'in_progress')`),
    index('experiments_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    check('experiments_number_positive', sql`${t.number} > 0`),
    check(
      'experiments_dates_ordered',
      sql`${t.targetDate} is null or ${t.startDate} is null or ${t.targetDate} >= ${t.startDate}`,
    ),
  ],
);

const experimentRef = () =>
  uuid('experiment_id')
    .notNull()
    .references(() => experiments.id, { onDelete: 'cascade' });

export const experimentConditions = pgTable(
  'experiment_conditions',
  {
    id: primaryId(),
    orgId: orgId(),
    experimentId: experimentRef(),
    name: text('name').notNull(),
    value: text('value').notNull(),
    /** Parsed from `value` when it is numeric, enabling cross-experiment comparison. */
    numericValue: numeric('numeric_value', { mode: 'number' }),
    unit: text('unit'),
    notes: text('notes'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [index('experiment_conditions_experiment_idx').on(t.experimentId, t.position)],
);

export const experimentInputs = pgTable(
  'experiment_inputs',
  {
    id: primaryId(),
    orgId: orgId(),
    experimentId: experimentRef(),
    name: text('name').notNull(),
    inputType: inputTypeEnum('input_type').notNull().default('reagent'),
    /** Catalog number, lot, or internal identifier. Future: FK to inventory items. */
    identifier: text('identifier'),
    quantity: numeric('quantity', { mode: 'number' }),
    unit: text('unit'),
    notes: text('notes'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [
    index('experiment_inputs_experiment_idx').on(t.experimentId, t.position),
    check('experiment_inputs_quantity_nonnegative', sql`${t.quantity} is null or ${t.quantity} >= 0`),
  ],
);

export const experimentProtocolSteps = pgTable(
  'experiment_protocol_steps',
  {
    id: primaryId(),
    orgId: orgId(),
    experimentId: experimentRef(),
    position: integer('position').notNull().default(0),
    title: text('title').notNull(),
    details: text('details'),
    durationMinutes: integer('duration_minutes'),
    completedAt: timestamptz('completed_at'),
    completedBy: uuid('completed_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
  },
  (t) => [index('experiment_steps_experiment_idx').on(t.experimentId, t.position)],
);

export const experimentObservations = pgTable(
  'experiment_observations',
  {
    id: primaryId(),
    orgId: orgId(),
    experimentId: experimentRef(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    observedAt: timestamptz('observed_at').notNull().defaultNow(),
    body: text('body').notNull(),
    significance: observationSignificanceEnum('significance').notNull().default('routine'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('experiment_observations_experiment_idx').on(t.experimentId, t.observedAt.desc())],
);

// ---------------------------------------------------------------------------
// Samples (minimal registry; full sample management is Phase 3)
// ---------------------------------------------------------------------------

export const samples = pgTable(
  'samples',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => entities.id, { onDelete: 'cascade' }),
    orgId: orgId(),
    number: integer('number').notNull(),
    displayId: text('display_id').notNull(),
    name: text('name').notNull(),
    /** Free text in V1; becomes sample_type_id → sample_types with a schema later. */
    sampleType: text('sample_type').notNull(),
    status: sampleStatusEnum('status').notNull().default('available'),
    parentSampleId: uuid('parent_sample_id').references((): AnyPgColumn => samples.id),
    projectId: uuid('project_id').references(() => projects.id),
    quantity: numeric('quantity', { mode: 'number' }),
    unit: text('unit'),
    /** Free text in V1; becomes container_id → containers → storage_locations later. */
    storageLocation: text('storage_location'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('samples_org_number_unique').on(t.orgId, t.number),
    index('samples_parent_idx').on(t.parentSampleId),
    index('samples_org_project_idx').on(t.orgId, t.projectId),
    index('samples_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    check('samples_no_self_parent', sql`${t.parentSampleId} is null or ${t.parentSampleId} <> ${t.id}`),
  ],
);

export const experimentSamples = pgTable(
  'experiment_samples',
  {
    experimentId: experimentRef(),
    sampleId: uuid('sample_id')
      .notNull()
      .references(() => samples.id, { onDelete: 'cascade' }),
    orgId: orgId(),
    role: experimentSampleRoleEnum('role').notNull().default('input'),
    notes: text('notes'),
    createdAt: createdAt(),
    createdBy: createdBy(),
  },
  (t) => [
    primaryKey({ columns: [t.experimentId, t.sampleId, t.role] }),
    index('experiment_samples_sample_idx').on(t.sampleId),
  ],
);

export const experimentResults = pgTable(
  'experiment_results',
  {
    id: primaryId(),
    orgId: orgId(),
    experimentId: experimentRef(),
    name: text('name').notNull(),
    valueNumeric: numeric('value_numeric', { mode: 'number' }),
    valueText: text('value_text'),
    unit: text('unit'),
    sampleId: uuid('sample_id').references(() => samples.id, { onDelete: 'set null' }),
    /** Key results surface on the timeline and project overview. */
    isKey: boolean('is_key').notNull().default(false),
    notes: text('notes'),
    recordedAt: timestamptz('recorded_at').notNull().defaultNow(),
    recordedBy: uuid('recorded_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('experiment_results_experiment_idx').on(t.experimentId),
    index('experiment_results_key_idx').on(t.orgId, t.recordedAt.desc()).where(sql`${t.isKey} and ${t.deletedAt} is null`),
    check('experiment_results_has_value', sql`${t.valueNumeric} is not null or ${t.valueText} is not null`),
  ],
);
