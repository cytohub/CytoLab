/**
 * Human-readable identifiers. UUIDs are the real keys; these are what scientists
 * type, say out loud, and write on tube labels.
 */

export const DISPLAY_ID_PREFIX = {
  experiment: 'EXP',
  sample: 'SMP',
} as const;

export function formatExperimentId(n: number): string {
  return `${DISPLAY_ID_PREFIX.experiment}-${String(n).padStart(4, '0')}`;
}

export function formatSampleId(n: number): string {
  return `${DISPLAY_ID_PREFIX.sample}-${String(n).padStart(5, '0')}`;
}

export function formatMilestoneId(sequence: number): string {
  return `M${sequence}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a route reference is a record's UUID rather than a code or display ID. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Project codes: 2–24 chars, uppercase letters/digits in dash-separated groups, e.g. CART-001. */
export const PROJECT_CODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
export const PROJECT_CODE_MAX = 24;

/** Codes reserved for generated identifiers so every display ID resolves unambiguously. */
const RESERVED_CODE_RE = new RegExp(`^(?:${Object.values(DISPLAY_ID_PREFIX).join('|')})-\\d+$`);

export function isValidProjectCode(code: string): boolean {
  return (
    code.length >= 2 &&
    code.length <= PROJECT_CODE_MAX &&
    PROJECT_CODE_RE.test(code) &&
    !RESERVED_CODE_RE.test(code)
  );
}

const STOP_WORDS = new Set(['and', 'of', 'the', 'for', 'in', 'on', 'to', 'a', 'an', 'with']);

/**
 * Suggests a short code from a project name: "CAR-T Cell Engineering" → "CART-CE".
 * The suffix keeps suggestions unique-ish; callers still validate uniqueness.
 */
export function suggestProjectCode(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .split(/[\s]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return '';
  const head = words[0]!.replace(/-/g, '').toUpperCase().slice(0, 6);
  const tail = words
    .slice(1)
    .map((w) => w.replace(/-/g, '')[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4);
  const code = tail ? `${head}-${tail}` : head;
  return code.length >= 2 ? code : `${code}X`;
}

/** Matches a string that looks like a generated display ID (e.g. "EXP-1024", "exp 1024"). */
export function parseDisplayId(query: string): { prefix: string; number: number } | null {
  const match = /^\s*([a-z]{2,4})[-\s]?(\d{1,7})\s*$/i.exec(query);
  if (!match) return null;
  return { prefix: match[1]!.toUpperCase(), number: Number(match[2]) };
}
