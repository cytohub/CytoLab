/**
 * Canonical value sets for the platform's structured fields.
 *
 * These arrays are the single source of truth: the database enums
 * (src/server/db/schema), Zod validation (src/domain/schemas) and UI
 * option lists are all derived from them.
 */

export const ROLES = ['admin', 'lab_manager', 'scientist', 'researcher', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const MEMBERSHIP_STATUSES = ['active', 'invited', 'suspended'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const USER_STATUSES = ['active', 'invited', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TEAM_ROLES = ['lead', 'member'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** First-class objects registered in the entity registry. Extend as modules ship. */
export const ENTITY_TYPES = ['project', 'experiment', 'sample'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const EXPERIMENT_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'archived',
] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

/** Statuses in which work is still expected to happen. */
export const OPEN_EXPERIMENT_STATUSES = ['planned', 'in_progress'] as const satisfies readonly ExperimentStatus[];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const SAMPLE_STATUSES = ['available', 'in_use', 'depleted', 'disposed'] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export const EXPERIMENT_SAMPLE_ROLES = ['input', 'output'] as const;
export type ExperimentSampleRole = (typeof EXPERIMENT_SAMPLE_ROLES)[number];

export const INPUT_TYPES = [
  'reagent',
  'cell_line',
  'plasmid',
  'antibody',
  'compound',
  'media',
  'consumable',
  'other',
] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const OBSERVATION_SIGNIFICANCE = ['routine', 'notable', 'critical'] as const;
export type ObservationSignificance = (typeof OBSERVATION_SIGNIFICANCE)[number];

export const LINK_TYPES = ['related_to', 'follow_up_of', 'replicate_of', 'derived_from', 'references'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const ACTOR_TYPES = ['user', 'system', 'integration', 'ai_agent'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'assignment',
  'status_change',
  'milestone',
  'comment',
  'project_update',
  'attention',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Objects that can be returned by global search. Users are indexed but are not entities. */
export const SEARCH_OBJECT_TYPES = ['project', 'experiment', 'user'] as const;
export type SearchObjectType = (typeof SEARCH_OBJECT_TYPES)[number];
