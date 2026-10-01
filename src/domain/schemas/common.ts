import { z } from 'zod';
import { MAX_YEAR, MIN_YEAR, isDateOnly, isReasonableInstant } from '../dates';

export const uuid = z.uuid({ error: 'Must be a valid identifier' });

const dateInRange = (value: string) => {
  const year = Number(value.slice(0, 4));
  return year >= MIN_YEAR && year <= MAX_YEAR;
};

export const dateOnly = z
  .string()
  .refine(isDateOnly, { error: 'Use a date in YYYY-MM-DD format' })
  .refine(dateInRange, { error: `Use a year between ${MIN_YEAR} and ${MAX_YEAR}` });

/** An ISO timestamp with an offset, within the supported year range. */
export const isoInstant = z.iso
  .datetime({ offset: true })
  .refine((value) => isReasonableInstant(new Date(value)), { error: `Use a year between ${MIN_YEAR} and ${MAX_YEAR}` });

const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Postgres text cannot hold NUL, and jsonb (feed payloads, audit diffs) rejects unpaired surrogates. */
export function isStorableText(value: string): boolean {
  return !value.includes('\u0000') && !LONE_SURROGATE_RE.test(value);
}
const storable = { error: 'Contains characters that cannot be stored' };

/** Required single-line text, trimmed. */
export const requiredText = (max: number, label = 'This field') =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` })
    .refine(isStorableText, storable);

/** Optional long-form text; empty strings are normalized to null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Must be at most ${max} characters` })
    .refine(isStorableText, storable)
    .nullish()
    .transform((v) => (v ? v : null));

/**
 * An array whose length is checked before its items, so an oversized list is
 * refused at once instead of validating (and reporting on) every entry.
 */
export function boundedArray<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(z.unknown())
    .max(max, { error: `At most ${max} items` })
    .pipe(z.array(item));
}

/** Design-token color names (resolved to concrete colors by the design system). */
export const COLOR_TOKENS = [
  'slate',
  'blue',
  'indigo',
  'violet',
  'pink',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export const colorToken = z.enum(COLOR_TOKENS);

// ---------------------------------------------------------------------------
// Query-string helpers (all query values arrive as strings)
// ---------------------------------------------------------------------------

/** Accepts `a,b` or repeated params and yields a de-duplicated array. */
export function csv<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parts = (Array.isArray(value) ? value : [value])
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
    return parts.length ? [...new Set(parts)] : undefined;
  }, boundedArray(item, 100).optional());
}

export const queryBoolean = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === '1' || value === true) return true;
  if (value === 'false' || value === '0' || value === false) return false;
  return value;
}, z.boolean().optional());

export const pageParams = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const searchText = z
  .string()
  .trim()
  .max(200)
  .refine(isStorableText, storable)
  .optional()
  .transform((v) => (v ? v : undefined));

/** `sort=-updatedAt` → { field: 'updatedAt', direction: 'desc' } */
export function sortParam<const F extends readonly [string, ...string[]]>(fields: F, fallback: `${'' | '-'}${F[number]}`) {
  return z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const value = raw ?? fallback;
      const direction = value.startsWith('-') ? ('desc' as const) : ('asc' as const);
      const field = value.replace(/^-/, '');
      if (!(fields as readonly string[]).includes(field)) {
        ctx.addIssue({ code: 'custom', message: `Sort must be one of: ${fields.join(', ')}` });
        return z.NEVER;
      }
      return { field: field as F[number], direction };
    });
}

export const expectedVersion = z.number().int().positive().optional();
