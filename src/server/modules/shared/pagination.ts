import 'server-only';
import { isReasonableInstant } from '@/domain/dates';
import { isUuid } from '@/domain/identifiers';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function offset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Cursor for the activity feed: occurredAt + id, so equal timestamps still paginate. */
export function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { occurredAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!iso || !id || !isUuid(id)) return null;
    const occurredAt = new Date(iso);
    return isReasonableInstant(occurredAt) ? { occurredAt, id } : null;
  } catch {
    return null;
  }
}
