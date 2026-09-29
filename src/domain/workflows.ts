import type { DateOnly } from './dates';
import type { ExperimentStatus, MilestoneStatus, ProjectStatus } from './enums';

/**
 * Status workflows. Transitions are explicit so every status change is intentional,
 * auditable, and consistent across UI, API, and future automation.
 */

export const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, readonly ExperimentStatus[]> = {
  planned: ['in_progress', 'cancelled', 'archived'],
  in_progress: ['completed', 'failed', 'cancelled', 'planned'],
  completed: ['in_progress', 'archived'],
  failed: ['in_progress', 'planned', 'archived'],
  cancelled: ['planned', 'archived'],
  archived: ['planned', 'completed', 'failed', 'cancelled'],
};

export const PROJECT_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  planning: ['active', 'on_hold', 'archived'],
  active: ['on_hold', 'completed', 'planning', 'archived'],
  on_hold: ['active', 'planning', 'archived'],
  completed: ['active', 'archived'],
  archived: ['planning', 'active', 'on_hold', 'completed'],
};

export function canTransitionExperiment(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return EXPERIMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_TRANSITIONS[from].includes(to);
}

export const TERMINAL_EXPERIMENT_STATUSES: ReadonlySet<ExperimentStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
  'archived',
]);

export function isOpenExperiment(status: ExperimentStatus): boolean {
  return status === 'planned' || status === 'in_progress';
}

export interface ExperimentDates {
  startDate: DateOnly | null;
  completedDate: DateOnly | null;
  blockedReason: string | null;
}

/**
 * Field changes implied by a status transition:
 * - starting work fills in the start date if it was never set;
 * - completing or failing records the completion date and clears blockers;
 * - moving back to an open state clears the completion date.
 */
export function experimentTransitionEffects(
  current: ExperimentDates,
  to: ExperimentStatus,
  today: DateOnly,
): Partial<ExperimentDates> {
  switch (to) {
    case 'in_progress':
      return { startDate: current.startDate ?? today, completedDate: null };
    case 'planned':
      return { completedDate: null };
    case 'completed':
    case 'failed':
      return { completedDate: current.completedDate ?? today, blockedReason: null };
    case 'cancelled':
      return { blockedReason: null };
    case 'archived':
      return {};
  }
}

export function projectTransitionEffects(to: ProjectStatus, now: Date): { completedAt?: Date | null } {
  if (to === 'completed') return { completedAt: now };
  if (to === 'archived') return {};
  return { completedAt: null };
}

export const MILESTONE_OPEN_STATUSES: ReadonlySet<MilestoneStatus> = new Set(['pending', 'in_progress']);
