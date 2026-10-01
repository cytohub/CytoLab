/**
 * Calendar-date helpers. Planning fields (start/target/completed dates) are
 * date-only values ("YYYY-MM-DD") interpreted in the organization's time zone.
 * Keeping them as strings avoids accidental time-zone shifts.
 */

export type DateOnly = string;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Years a planning date or timestamp may fall in; Postgres rejects some values outside it. */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2200;

/** Whether an instant falls within MIN_YEAR..MAX_YEAR (cursors and timestamps from clients). */
export function isReasonableInstant(date: Date): boolean {
  const year = date.getUTCFullYear();
  return !Number.isNaN(date.getTime()) && year >= MIN_YEAR && year <= MAX_YEAR;
}

export function isDateOnly(value: string): value is DateOnly {
  if (!DATE_ONLY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): DateOnly {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtcMs(date: DateOnly): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateOnly, to: DateOnly): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Calendar date of an instant in the given time zone. */
export function dateOf(instant: Date, timeZone: string): DateOnly {
  return todayIn(timeZone, instant);
}

export function compareDates(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
