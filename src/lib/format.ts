/** Client-safe formatting helpers. Dates are rendered consistently across the app. */

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DATE_SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const DATETIME_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Formats a date-only string (YYYY-MM-DD) without time-zone drift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FMT.format(date);
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_SHORT_FMT.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATETIME_FMT.format(date);
}

const REL_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];
const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

/** "3 days ago", "just now", "in 2 weeks". */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 45_000) return 'just now';
  for (const [unit, ms] of REL_UNITS) {
    if (abs >= ms || unit === 'minute') return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

/** Compact number: 1234 → "1.2k". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Formats a measured value with an optional unit, using significant digits sensibly. */
export function formatMeasurement(value: number | null, unit: string | null, text?: string | null): string {
  if (value === null) return text ?? '—';
  const abs = Math.abs(value);
  let formatted: string;
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) formatted = value.toExponential(2);
  else formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function initials(name: string): string {
  const parts = name.replace(/^(dr|prof|mr|mrs|ms|mx)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '')).toUpperCase() || '?';
}
