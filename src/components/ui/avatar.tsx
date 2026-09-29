import * as React from 'react';
import { cn } from '@/lib/cn';
import { avatarClass } from '@/lib/colors';
import { initials as computeInitials } from '@/lib/format';

const sizeClasses = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-lg',
} as const;

export interface AvatarProps {
  name: string;
  initials?: string;
  color?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
  title?: string;
}

export function Avatar({ name, initials, color, avatarUrl, size = 'md', className, title }: AvatarProps) {
  const label = initials ?? computeInitials(name);
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/5 select-none', sizeClasses[size], avatarClass(color), className)}
      title={title ?? name}
      aria-label={name}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
      ) : (
        label
      )}
    </span>
  );
}

export interface AvatarPerson {
  name: string;
  initials?: string;
  avatarColor?: string | null;
  avatarUrl?: string | null;
}

/** Overlapping avatar stack with an overflow count. */
export function AvatarStack({ people, max = 4, size = 'sm' }: { people: AvatarPerson[]; max?: number; size?: keyof typeof sizeClasses }) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} initials={p.initials} color={p.avatarColor} avatarUrl={p.avatarUrl} size={size} className="ring-2 ring-surface" />
      ))}
      {overflow > 0 && (
        <span className={cn('relative inline-flex items-center justify-center rounded-full bg-surface-hover font-semibold text-fg-muted ring-2 ring-surface', sizeClasses[size])}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
