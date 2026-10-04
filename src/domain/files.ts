/**
 * Rules for uploaded files: what is stored about them and how they are served.
 * Pure, so the upload handler, the download route and tests share one version.
 */

/**
 * Types served as stored: ones a browser neither runs nor renders as a page.
 * Everything else is downloaded as opaque bytes, since uploads accept any
 * `text/*` and `image/*` and a blocklist misses aliases such as
 * `text/x-javascript`, which would load as a same-origin script.
 */
const PASSIVE_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'application/zip',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

// Bidirectional controls let a name display as something else ("invoice\u202Efdp.exe"
// shows as "invoiceexe.pdf"), so they go with the other control characters.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Control characters and unpaired surrogates removed; capped by code point so no pair is split. */
export function normalizeFileName(raw: string): string {
  const cleaned = raw.replace(CONTROL_CHARS, '').replace(LONE_SURROGATES, '').trim();
  return Array.from(cleaned).slice(0, MAX_FILE_NAME_CHARS).join('') || 'upload';
}

/** The content type to serve a stored file as. */
export function downloadContentType(stored: string): string {
  return PASSIVE_TYPES.has(stored) ? stored : 'application/octet-stream';
}
