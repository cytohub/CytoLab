/**
 * Rules for uploaded files: what is stored about them and how they are served.
 * Pure, so the upload handler, the download route and tests share one version.
 */

/** Types a browser would run or render as a document; they are downloaded as opaque bytes. */
const ACTIVE_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/xml',
  'application/xml',
  'text/javascript',
  'application/javascript',
]);

const MEDIA_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/;
export const MAX_FILE_NAME_CHARS = 255;
export const MAX_DESCRIPTION_CHARS = 2_000;

/** `type/subtype` only, lower-cased; parameters and anything malformed are dropped. */
export function normalizeContentType(raw: string): string {
  const base = raw.split(';')[0]!.trim().toLowerCase();
  return MEDIA_TYPE_RE.test(base) ? base : 'application/octet-stream';
}

const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Control characters and unpaired surrogates removed; capped by code point so no pair is split. */
export function normalizeFileName(raw: string): string {
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(LONE_SURROGATES, '').trim();
  return Array.from(cleaned).slice(0, MAX_FILE_NAME_CHARS).join('') || 'upload';
}

/** The content type to serve a stored file as. */
export function downloadContentType(stored: string): string {
  return ACTIVE_TYPES.has(stored) ? 'application/octet-stream' : stored;
}
