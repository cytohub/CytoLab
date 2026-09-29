import { describe, expect, it } from 'vitest';
import {
  computeProjectHealth,
  computeProjectProgress,
  expectedProgress,
  type ExperimentCounts,
  type MilestoneCounts,
} from './project-metrics';

const noMilestones: MilestoneCounts = { total: 0, completed: 0, cancelled: 0, overdue: 0 };
const noExperiments: ExperimentCounts = { total: 0, completed: 0, failed: 0, cancelled: 0, archived: 0, open: 0, needsAttention: 0 };

describe('computeProjectProgress', () => {
  it('is 100% for a completed project regardless of counts', () => {
    expect(computeProjectProgress('completed', noMilestones, noExperiments).percent).toBe(100);
  });

  it('prefers milestones when present, excluding cancelled from scope', () => {
    const progress = computeProjectProgress('active', { total: 5, completed: 2, cancelled: 1, overdue: 0 }, noExperiments);
    expect(progress.basis).toBe('milestones');
    expect(progress.percent).toBe(50); // 2 of 4 (5 - 1 cancelled)
  });

  it('falls back to experiments when there are no milestones', () => {
    const progress = computeProjectProgress('active', noMilestones, { ...noExperiments, total: 10, completed: 4, cancelled: 1, archived: 1 });
    expect(progress.basis).toBe('experiments');
    expect(progress.percent).toBe(50); // 4 of 8
  });

  it('is 0% with no basis when nothing is tracked', () => {
    const progress = computeProjectProgress('planning', noMilestones, noExperiments);
    expect(progress).toMatchObject({ percent: 0, basis: 'none' });
  });
});

describe('expectedProgress', () => {
  it('returns the elapsed fraction of the planned window', () => {
    expect(expectedProgress('2026-01-01', '2026-01-11', '2026-01-06')).toBe(50);
  });
  it('is null without both dates', () => {
    expect(expectedProgress(null, '2026-01-11', '2026-01-06')).toBeNull();
  });
  it('clamps to 0–100', () => {
    expect(expectedProgress('2026-01-01', '2026-01-11', '2026-02-01')).toBe(100);
  });
});

describe('computeProjectHealth', () => {
  const base = { status: 'active' as const, startDate: '2026-01-01', targetDate: '2026-03-01' };

  it('is inactive for non-active/planning projects', () => {
    const health = computeProjectHealth({ ...base, status: 'on_hold', progress: computeProjectProgress('on_hold', noMilestones, noExperiments), milestones: noMilestones, experiments: noExperiments }, '2026-02-01');
    expect(health.status).toBe('inactive');
  });

  it('is off_track when the target date has passed', () => {
    const progress = computeProjectProgress('active', { total: 4, completed: 2, cancelled: 0, overdue: 0 }, noExperiments);
    const health = computeProjectHealth({ ...base, progress, milestones: { total: 4, completed: 2, cancelled: 0, overdue: 0 }, experiments: noExperiments }, '2026-04-01');
    expect(health.status).toBe('off_track');
    expect(health.reasons.some((r) => /target date/i.test(r.message))).toBe(true);
  });

  it('is at_risk when meaningfully behind the schedule pace', () => {
    // 90% of the window elapsed, only 20% done → 70 point gap.
    const progress = computeProjectProgress('active', { total: 10, completed: 2, cancelled: 0, overdue: 0 }, noExperiments);
    const health = computeProjectHealth({ ...base, progress, milestones: { total: 10, completed: 2, cancelled: 0, overdue: 0 }, experiments: noExperiments }, '2026-02-24');
    expect(['at_risk', 'off_track']).toContain(health.status);
  });

  it('is on_track when progress keeps pace with the schedule', () => {
    const progress = computeProjectProgress('active', { total: 10, completed: 6, cancelled: 0, overdue: 0 }, noExperiments);
    const health = computeProjectHealth({ ...base, progress, milestones: { total: 10, completed: 6, cancelled: 0, overdue: 0 }, experiments: noExperiments }, '2026-02-01');
    expect(health.status).toBe('on_track');
    expect(health.reasons).toHaveLength(0);
  });
});
