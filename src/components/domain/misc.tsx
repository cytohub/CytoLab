import Link from 'next/link';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { chipClass } from '@/lib/colors';
import type { TagSummary, UserSummary } from '@/server/modules/shared/presenters';

/** A person shown inline: avatar + name, optionally linking to their profile. */
export function UserCell({ user, href, size = 'sm', muted }: { user: UserSummary | null; href?: string; size?: 'xs' | 'sm' | 'md'; muted?: boolean }) {
  if (!user) return <span className="text-sm text-fg-faint">Unassigned</span>;
  const inner = (
    <span className={cn('inline-flex items-center gap-2', muted ? 'text-fg-muted' : 'text-fg')}>
      <Avatar name={user.name} initials={user.initials} color={user.avatarColor} avatarUrl={user.avatarUrl} size={size} />
      <span className="truncate text-sm font-medium">{user.name}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="rounded-md transition-opacity hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function TagChip({ tag, className }: { tag: TagSummary; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', chipClass(tag.color), className)}>{tag.name}</span>
  );
}

export function TagList({ tags, max, className }: { tags: TagSummary[]; max?: number; className?: string }) {
  if (tags.length === 0) return null;
  const shown = max ? tags.slice(0, max) : tags;
  const overflow = tags.length - shown.length;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {shown.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {overflow > 0 && <span className="text-[11px] text-fg-subtle">+{overflow}</span>}
    </span>
  );
}

/** Small colored dot + label (research area, experiment type, team). */
export function ColorLabel({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-fg-muted', className)}>
      <span className={cn('size-2 shrink-0 rounded-full', chipClass(color))} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Monospace identifier chip (EXP-1024, CART-001). */
export function IdTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-xs font-medium text-fg-subtle', className)}>{children}</span>;
}

export function KeyValue({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}
