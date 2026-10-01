import 'server-only';

/** The Postgres error code of a failed query. Drizzle wraps driver errors, so it may sit on `cause`. */
export function pgErrorCode(err: unknown): string | undefined {
  for (const candidate of [err, (err as { cause?: unknown } | null)?.cause]) {
    const code = candidate && typeof candidate === 'object' ? (candidate as { code?: unknown }).code : undefined;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505';
}

/** Escapes LIKE wildcards so user text matches literally (backslash is Postgres's default escape). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
