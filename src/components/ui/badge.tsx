import * as React from 'react';
import type { Tone } from '@/domain/labels';
import { cn } from '@/lib/cn';
import { dotClass, toneClass } from '@/lib/colors';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Show a leading status dot instead of a filled chip background. */
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', dot = false, size = 'md', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        dot ? 'bg-transparent text-fg-muted' : toneClass(tone),
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dotClass(tone))} aria-hidden />}
      {children}
    </span>
  );
}

/** A label:value chip used in property rails. */
export function MetaChip({ icon, children, className }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-fg-muted', className)}>
      {icon}
      {children}
    </span>
  );
}
