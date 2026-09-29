import type {
  ExperimentSampleRole,
  ExperimentStatus,
  InputType,
  LinkType,
  MilestoneStatus,
  ObservationSignificance,
  Priority,
  ProjectStatus,
  Role,
  SampleStatus,
  TeamRole,
} from './enums';

/**
 * Semantic tones map domain states to the design system's status palette.
 * Components translate a tone into concrete colors; the domain never knows about CSS.
 */
export type Tone = 'neutral' | 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'muted';

export interface StateMeta {
  label: string;
  tone: Tone;
  description?: string;
}

export const PROJECT_STATUS_META: Record<ProjectStatus, StateMeta> = {
  planning: { label: 'Planning', tone: 'violet', description: 'Scoping aims, resources and milestones' },
  active: { label: 'Active', tone: 'blue', description: 'Experiments are under way' },
  on_hold: { label: 'On hold', tone: 'amber', description: 'Paused pending a decision or resources' },
  completed: { label: 'Completed', tone: 'green', description: 'Objectives delivered' },
  archived: { label: 'Archived', tone: 'muted', description: 'Kept for reference only' },
};

export const EXPERIMENT_STATUS_META: Record<ExperimentStatus, StateMeta> = {
  planned: { label: 'Planned', tone: 'neutral', description: 'Designed and scheduled, not started' },
  in_progress: { label: 'In progress', tone: 'blue', description: 'Bench work or analysis under way' },
  completed: { label: 'Completed', tone: 'green', description: 'Executed and results recorded' },
  failed: { label: 'Failed', tone: 'red', description: 'Could not be executed or results are invalid' },
  cancelled: { label: 'Cancelled', tone: 'muted', description: 'Stopped before completion' },
  archived: { label: 'Archived', tone: 'muted', description: 'Kept for reference only' },
};

export const MILESTONE_STATUS_META: Record<MilestoneStatus, StateMeta> = {
  pending: { label: 'Pending', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'blue' },
  completed: { label: 'Reached', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const PRIORITY_META: Record<Priority, StateMeta & { rank: number }> = {
  low: { label: 'Low', tone: 'neutral', rank: 0 },
  medium: { label: 'Medium', tone: 'blue', rank: 1 },
  high: { label: 'High', tone: 'amber', rank: 2 },
  critical: { label: 'Critical', tone: 'red', rank: 3 },
};

export const SAMPLE_STATUS_META: Record<SampleStatus, StateMeta> = {
  available: { label: 'Available', tone: 'green' },
  in_use: { label: 'In use', tone: 'blue' },
  depleted: { label: 'Depleted', tone: 'amber' },
  disposed: { label: 'Disposed', tone: 'muted' },
};

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  admin: { label: 'Admin', description: 'Full access, including members, roles and organization settings' },
  lab_manager: { label: 'Lab Manager', description: 'Manages teams, configuration and all research records' },
  scientist: { label: 'Scientist', description: 'Leads projects, milestones and experiments' },
  researcher: { label: 'Researcher', description: 'Runs and records the experiments they are assigned' },
  viewer: { label: 'Viewer', description: 'Read-only access to research records' },
};

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = { lead: 'Lead', member: 'Member' };

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  reagent: 'Reagent',
  cell_line: 'Cell line',
  plasmid: 'Plasmid',
  antibody: 'Antibody',
  compound: 'Compound',
  media: 'Media',
  consumable: 'Consumable',
  other: 'Other',
};

export const OBSERVATION_SIGNIFICANCE_META: Record<ObservationSignificance, StateMeta> = {
  routine: { label: 'Routine', tone: 'neutral' },
  notable: { label: 'Notable', tone: 'blue' },
  critical: { label: 'Critical', tone: 'red' },
};

export const SAMPLE_ROLE_LABELS: Record<ExperimentSampleRole, string> = { input: 'Input', output: 'Output' };

export const LINK_TYPE_LABELS: Record<LinkType, { forward: string; reverse: string }> = {
  related_to: { forward: 'Related to', reverse: 'Related to' },
  follow_up_of: { forward: 'Follow-up of', reverse: 'Followed up by' },
  replicate_of: { forward: 'Replicate of', reverse: 'Replicated by' },
  derived_from: { forward: 'Derived from', reverse: 'Source of' },
  references: { forward: 'References', reverse: 'Referenced by' },
};
