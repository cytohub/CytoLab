import 'server-only';
import type { Tone } from '@/domain/labels';

/** A person as shown in the UI (avatars, bylines). */
export interface UserSummary {
  id: string;
  name: string;
  title: string | null;
  email: string;
  avatarColor: string;
  avatarUrl: string | null;
  initials: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  color: string;
}

export interface TagSummary {
  id: string;
  name: string;
  color: string;
}

export interface StatePresenter {
  value: string;
  label: string;
  tone: Tone;
}

export function initialsOf(name: string): string {
  const parts = name
    .replace(/^(dr|prof|mr|mrs|ms|mx)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface UserSummaryRow {
  id: string;
  name: string;
  title: string | null;
  email: string;
  avatarColor: string;
  avatarUrl: string | null;
}

export function toUserSummary(row: UserSummaryRow | null): UserSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    email: row.email,
    avatarColor: row.avatarColor,
    avatarUrl: row.avatarUrl,
    initials: initialsOf(row.name),
  };
}
