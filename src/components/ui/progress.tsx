import * as React from 'react';
import type { Tone } from '@/domain/labels';
import { cn } from '@/lib/cn';

const fillByTone: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  blue: 'bg-[var(--tone-blue-fg)]',
  green: 'bg-[var(--tone-green-fg)]',
  red: 'bg-[var(--tone-red-fg)]',
  amber: 'bg-[var(--tone-amber-fg)]',
  violet: 'bg-[var(--tone-violet-fg)]',
  muted: 'bg-fg-faint',
};

export function ProgressBar({
  value,
  tone = 'blue',
  className,
  markerAt,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  /** Optional reference marker (e.g. expected progress) drawn as a vertical line. */
  markerAt?: number | null;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-full bg-surface-hover', size === 'sm' ? 'h-1.5' : 'h-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fillByTone[tone])} style={{ width: `${clamped}%` }} />
      {markerAt != null && markerAt >= 0 && markerAt <= 100 && (
        <div className="absolute top-0 h-full w-0.5 bg-fg/40" style={{ left: `${markerAt}%` }} title={`Expected ${Math.round(markerAt)}%`} />
      )}
    </div>
  );
}
