import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-fg-subtle', className)} aria-label="Loading" />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-surface-hover', className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center', className)}>
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-hover text-fg-subtle [&_svg]:size-5">{icon}</div>}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-md border border-[color:var(--tone-red-fg)]/25 bg-[var(--tone-red-bg)] px-3 py-2 text-sm text-[color:var(--tone-red-fg)]', className)} role="alert">
      {children}
    </div>
  );
}
