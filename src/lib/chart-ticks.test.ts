import { describe, expect, it } from 'vitest';
import { evenTicks } from './chart-ticks';

const weeks = (n: number) => Array.from({ length: n }, (_, i) => `w${i + 1}`);

describe('evenTicks', () => {
  it('keeps every label when they all fit', () => {
    expect(evenTicks(weeks(5))).toEqual(['w1', 'w2', 'w3', 'w4', 'w5']);
    expect(evenTicks([])).toEqual([]);
  });

  it('uses one even stride and always labels the latest period', () => {
    // 12 weekly points → every other week, ending on the last one.
    expect(evenTicks(weeks(12))).toEqual(['w2', 'w4', 'w6', 'w8', 'w10', 'w12']);
    // 26 weekly points → every fifth week.
    expect(evenTicks(weeks(26))).toEqual(['w1', 'w6', 'w11', 'w16', 'w21', 'w26']);
  });

  it('never exceeds the maximum', () => {
    for (let n = 1; n <= 60; n++) {
      const ticks = evenTicks(weeks(n));
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks.at(-1)).toBe(`w${n}`);
    }
  });
});
