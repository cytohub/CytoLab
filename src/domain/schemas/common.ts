import { z } from 'zod';
import { isDateOnly } from '../dates';

export const uuid = z.uuid({ error: 'Must be a valid identifier' });

export const dateOnly = z.string().refine(isDateOnly, { error: 'Use a date in YYYY-MM-DD format' });

/** Required single-line text, trimmed. */
export const requiredText = (max: number, label = 'This field') =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });

/** Optional long-form text; empty strings are normalized to null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Must be at most ${max} characters` })
    .nullish()
    .transform((v) => (v ? v : null));

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
  }, z.array(item).optional());
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

export const searchText = z.string().trim().max(200).optional().transform((v) => (v ? v : undefined));

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
