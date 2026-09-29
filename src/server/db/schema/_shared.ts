import { customType, pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  ACTOR_TYPES,
  ENTITY_TYPES,
  EXPERIMENT_SAMPLE_ROLES,
  EXPERIMENT_STATUSES,
  INPUT_TYPES,
  LINK_TYPES,
  MEMBERSHIP_STATUSES,
  MILESTONE_STATUSES,
  NOTIFICATION_TYPES,
  OBSERVATION_SIGNIFICANCE,
  PRIORITIES,
  PROJECT_STATUSES,
  ROLES,
  SAMPLE_STATUSES,
  TEAM_ROLES,
  USER_STATUSES,
} from '../../../domain/enums';
import { uuidv7 } from '../uuid';

// Postgres enums derived from the domain value sets.
export const roleEnum = pgEnum('member_role', ROLES);
export const membershipStatusEnum = pgEnum('membership_status', MEMBERSHIP_STATUSES);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const teamRoleEnum = pgEnum('team_role', TEAM_ROLES);
export const entityTypeEnum = pgEnum('entity_type', ENTITY_TYPES);
export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUSES);
export const experimentStatusEnum = pgEnum('experiment_status', EXPERIMENT_STATUSES);
export const priorityEnum = pgEnum('priority', PRIORITIES);
export const milestoneStatusEnum = pgEnum('milestone_status', MILESTONE_STATUSES);
export const sampleStatusEnum = pgEnum('sample_status', SAMPLE_STATUSES);
export const experimentSampleRoleEnum = pgEnum('experiment_sample_role', EXPERIMENT_SAMPLE_ROLES);
export const inputTypeEnum = pgEnum('input_type', INPUT_TYPES);
export const observationSignificanceEnum = pgEnum('observation_significance', OBSERVATION_SIGNIFICANCE);
export const linkTypeEnum = pgEnum('link_type', LINK_TYPES);
export const actorTypeEnum = pgEnum('actor_type', ACTOR_TYPES);
export const notificationTypeEnum = pgEnum('notification_type', NOTIFICATION_TYPES);

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** App-generated UUIDv7 primary key, with a database default as a safety net. */
export const primaryId = () =>
  uuid('id')
    .primaryKey()
    .defaultRandom()
    .$defaultFn(() => uuidv7());

export const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());

export const deletedAt = () => timestamp('deleted_at', { withTimezone: true, mode: 'date' });

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
