import { describe, expect, it } from 'vitest';
import { formatExperimentId, formatSampleId, isValidProjectCode, parseDisplayId, suggestProjectCode } from './identifiers';
import { diffFields, hasChanges } from './diff';

describe('display identifiers', () => {
  it('formats experiment and sample IDs with padding', () => {
    expect(formatExperimentId(1024)).toBe('EXP-1024');
    expect(formatSampleId(42)).toBe('SMP-00042');
  });

  it('validates project codes', () => {
    expect(isValidProjectCode('CART-001')).toBe(true);
    expect(isValidProjectCode('MRNA-LNP')).toBe(true);
    expect(isValidProjectCode('a')).toBe(false); // too short / lowercase
    expect(isValidProjectCode('has space')).toBe(false);
    expect(isValidProjectCode('EXP-1024')).toBe(false); // reserved generated form
  });

  it('suggests codes from project names', () => {
    expect(suggestProjectCode('CAR-T Cell Engineering')).toMatch(/^[A-Z0-9-]+$/);
    expect(suggestProjectCode('mRNA Delivery Platform')).toContain('MRNA');
  });

  it('parses generated display IDs from free text', () => {
    expect(parseDisplayId('EXP-1024')).toEqual({ prefix: 'EXP', number: 1024 });
    expect(parseDisplayId('exp 1024')).toEqual({ prefix: 'EXP', number: 1024 });
    expect(parseDisplayId('not an id')).toBeNull();
  });
});

describe('diffFields', () => {
  it('reports only changed, provided fields', () => {
    const changes = diffFields({ a: 1, b: 'x', c: null }, { a: 2, b: 'x', d: undefined });
    expect(changes).toEqual({ a: { from: 1, to: 2 } });
    expect(hasChanges(changes)).toBe(true);
  });

  it('treats Date values by ISO string and ignores undefined patches', () => {
    const before = { at: new Date('2026-01-01T00:00:00Z') };
    expect(hasChanges(diffFields(before, { at: new Date('2026-01-01T00:00:00Z') }))).toBe(false);
    expect(hasChanges(diffFields(before, { at: new Date('2026-02-01T00:00:00Z') }))).toBe(true);
  });
});
