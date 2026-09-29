import { describe, expect, it } from 'vitest';
import { canTransitionExperiment, canTransitionProject, experimentTransitionEffects, isOpenExperiment } from './workflows';

describe('experiment workflow', () => {
  it('allows valid transitions and rejects invalid ones', () => {
    expect(canTransitionExperiment('planned', 'in_progress')).toBe(true);
    expect(canTransitionExperiment('in_progress', 'completed')).toBe(true);
    expect(canTransitionExperiment('completed', 'planned')).toBe(false);
    expect(canTransitionExperiment('planned', 'completed')).toBe(false);
  });

  it('identifies open statuses', () => {
    expect(isOpenExperiment('in_progress')).toBe(true);
    expect(isOpenExperiment('completed')).toBe(false);
  });

  describe('transition effects', () => {
    const dates = { startDate: null, completedDate: null, blockedReason: 'stuck' };

    it('sets the start date when work begins if unset', () => {
      expect(experimentTransitionEffects(dates, 'in_progress', '2026-06-15')).toMatchObject({ startDate: '2026-06-15', completedDate: null });
    });

    it('keeps an existing start date', () => {
      expect(experimentTransitionEffects({ ...dates, startDate: '2026-01-01' }, 'in_progress', '2026-06-15').startDate).toBe('2026-01-01');
    });

    it('records completion date and clears the blocker on completion', () => {
      expect(experimentTransitionEffects(dates, 'completed', '2026-06-15')).toMatchObject({ completedDate: '2026-06-15', blockedReason: null });
    });

    it('clears the completion date when reopening', () => {
      expect(experimentTransitionEffects({ ...dates, completedDate: '2026-05-01' }, 'planned', '2026-06-15')).toMatchObject({ completedDate: null });
    });
  });
});

describe('project workflow', () => {
  it('allows sensible transitions', () => {
    expect(canTransitionProject('planning', 'active')).toBe(true);
    expect(canTransitionProject('active', 'completed')).toBe(true);
    expect(canTransitionProject('completed', 'planning')).toBe(false);
  });
});
