import { AlertTriangle, ArrowRight, Ban, CircleDot, Flame, Minus, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import * as React from 'react';
import type { Tone } from '@/domain/labels';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

/** A generic labeled state chip (status, milestone status, significance, …). */
export function StateBadge({ state, dot = true, size = 'md' }: { state: { label: string; tone: string }; dot?: boolean; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={state.tone as Tone} dot={dot} size={size}>
      {state.label}
    </Badge>
  );
}

const priorityIcon = {
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
  critical: Flame,
} as const;

export function PriorityIndicator({ priority, withLabel = false }: { priority: { value: string; label: string; tone: string }; withLabel?: boolean }) {
  const Icon = priorityIcon[priority.value as keyof typeof priorityIcon] ?? Minus;
  const color = { neutral: 'text-fg-subtle', blue: 'text-[var(--tone-blue-fg)]', amber: 'text-[var(--tone-amber-fg)]', red: 'text-[var(--tone-red-fg)]' }[priority.tone] ?? 'text-fg-subtle';
  const node = (
    <span className={cn('inline-flex items-center gap-1.5', color)}>
      <Icon className="size-4" aria-hidden />
      {withLabel && <span className="text-sm font-medium">{priority.label}</span>}
    </span>
  );
  return withLabel ? node : <Tooltip content={`${priority.label} priority`}>{node}</Tooltip>;
}

export function HealthBadge({ health, size = 'md' }: { health: { label: string; tone: string }; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={health.tone as Tone} dot size={size}>
      {health.label}
    </Badge>
  );
}

/** Attention indicator for an experiment (severity-colored warning icon). */
export function AttentionFlag({
  attention,
  className,
}: {
  attention: { needsAttention: boolean; severity?: string | null; reasons: Array<{ message: string; severity: string }> };
  className?: string;
}) {
  if (!attention.needsAttention) return null;
  const severity = attention.severity ?? attention.reasons[0]?.severity ?? 'low';
  const color = severity === 'high' ? 'text-[var(--tone-red-fg)]' : severity === 'medium' ? 'text-[var(--tone-amber-fg)]' : 'text-fg-subtle';
  return (
    <Tooltip content={<span className="block space-y-0.5">{attention.reasons.map((r, i) => <span key={i} className="block">{r.message}</span>)}</span>}>
      <span className={cn('inline-flex', color, className)}>
        <AlertTriangle className="size-4" aria-label="Needs attention" />
      </span>
    </Tooltip>
  );
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  status_changed: ArrowRight,
  created: CircleDot,
  completed: CircleDot,
  deleted: Ban,
};

export function ActivityIcon({ action, className }: { action: string; className?: string }) {
  const verb = action.split('.')[1] ?? '';
  const Icon = activityIcons[verb] ?? CircleDot;
  return <Icon className={cn('size-3.5', className)} aria-hidden />;
}
