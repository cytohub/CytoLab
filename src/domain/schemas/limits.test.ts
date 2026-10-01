import { describe, expect, it } from 'vitest';
import { observationSchema, updateStepSchema } from './experiments';
import { createTagSchema, loginSchema, markNotificationsSchema, searchQuerySchema } from './platform';
import { dateOnly } from './common';

describe('input limits', () => {
  it('refuses an oversized array on its length alone', () => {
    const result = markNotificationsSchema.safeParse({ ids: Array.from({ length: 400_000 }, () => 1) });
    expect(result.success).toBe(false);
    expect(result.error!.issues).toHaveLength(1);
    expect(result.error!.issues[0]!.path).toEqual(['ids']);
  });

  it('caps email addresses at 254 characters', () => {
    expect(loginSchema.safeParse({ email: `${'a'.repeat(60)}@example.com`, password: 'x' }).success).toBe(true);
    const long = `x@${Array.from({ length: 10 }, () => 'b'.repeat(60)).join('.')}.com`;
    expect(loginSchema.safeParse({ email: long, password: 'x' }).success).toBe(false);
  });

  it('refuses text Postgres or jsonb cannot store', () => {
    expect(createTagSchema.safeParse({ name: 'qc\u0000' }).success).toBe(false);
    expect(createTagSchema.safeParse({ name: 'qc\uD800' }).success).toBe(false);
    expect(createTagSchema.safeParse({ name: 'qc 🧪' }).success).toBe(true);
    expect(searchQuerySchema.safeParse({ q: 'a\u0000b' }).success).toBe(false);
  });

  it('keeps dates and positions in a range Postgres accepts', () => {
    expect(dateOnly.safeParse('0000-01-01').success).toBe(false);
    expect(dateOnly.safeParse('2026-10-01').success).toBe(true);
    expect(observationSchema.safeParse({ body: 'x', observedAt: '0000-01-01T00:00:00Z' }).success).toBe(false);
    expect(observationSchema.safeParse({ body: 'x', observedAt: '2026-10-01T09:30:00Z' }).success).toBe(true);
    expect(updateStepSchema.safeParse({ position: 3_000_000_000 }).success).toBe(false);
  });
});
