import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { evaluateAttention, isDelayed, topSeverity, type AttentionInput } from './attention';

const TODAY = '2026-06-15';

function input(overrides: Partial<AttentionInput>): AttentionInput {
  return {
    status: 'in_progress',
    startDate: '2026-06-01',
    targetDate: null,
    blockedReason: null,
    lastActivityDate: TODAY,
    statusChangedDate: TODAY,
    ...overrides,
  };
}

describe('evaluateAttention', () => {
  it('flags a blocked open experiment as high severity', () => {
    const reasons = evaluateAttention(input({ blockedReason: 'Reagent QC' }), TODAY);
    expect(reasons.find((r) => r.code === 'blocked')?.severity).toBe('high');
  });

  it('does not flag a blocked experiment once it is completed', () => {
    const reasons = evaluateAttention(input({ status: 'completed', blockedReason: 'Reagent QC' }), TODAY);
    expect(reasons).toHaveLength(0);
  });

  it('flags overdue open experiments and escalates when severely overdue', () => {
    const mild = evaluateAttention(input({ targetDate: addDays(TODAY, -3) }), TODAY);
    expect(mild.find((r) => r.code === 'overdue')?.severity).toBe('medium');

    const severe = evaluateAttention(input({ targetDate: addDays(TODAY, -30) }), TODAY);
    expect(severe.find((r) => r.code === 'overdue')?.severity).toBe('high');
  });

  it('flags a planned experiment whose start date has passed the grace window', () => {
    const reasons = evaluateAttention(input({ status: 'planned', startDate: addDays(TODAY, -5) }), TODAY);
    expect(reasons.some((r) => r.code === 'not_started')).toBe(true);
  });

  it('does not flag a planned experiment still within the grace window', () => {
    const reasons = evaluateAttention(input({ status: 'planned', startDate: addDays(TODAY, -1), targetDate: addDays(TODAY, 10) }), TODAY);
    expect(reasons).toHaveLength(0);
  });

  it('flags a stale in-progress experiment (no activity for 14+ days)', () => {
    const reasons = evaluateAttention(input({ lastActivityDate: addDays(TODAY, -20) }), TODAY);
    expect(reasons.some((r) => r.code === 'stale')).toBe(true);
  });

  it('flags a recent failure for review but not an old one', () => {
    const recent = evaluateAttention(input({ status: 'failed', statusChangedDate: addDays(TODAY, -2) }), TODAY);
    expect(recent.some((r) => r.code === 'recent_failure')).toBe(true);

    const old = evaluateAttention(input({ status: 'failed', statusChangedDate: addDays(TODAY, -30) }), TODAY);
    expect(old).toHaveLength(0);
  });

  it('orders reasons by severity (high first)', () => {
    const reasons = evaluateAttention(input({ blockedReason: 'x', targetDate: addDays(TODAY, -3) }), TODAY);
    expect(topSeverity(reasons)).toBe('high');
    expect(reasons[0]!.severity).toBe('high');
  });

  it('reports delayed only when overdue', () => {
    expect(isDelayed(evaluateAttention(input({ targetDate: addDays(TODAY, -1) }), TODAY))).toBe(true);
    expect(isDelayed(evaluateAttention(input({ lastActivityDate: addDays(TODAY, -20) }), TODAY))).toBe(false);
  });
});
