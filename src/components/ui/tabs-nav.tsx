'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  href: string;
  label: string;
  count?: number | null;
  /** Match this exact path only (default: prefix match for nested routes). */
  exact?: boolean;
}

/** Underlined tab bar backed by real routes (shareable, back-button friendly). */
export function TabsNav({ tabs, className }: { tabs: TabItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn('rounded-full px-1.5 py-px text-[11px] tabular-nums', active ? 'bg-accent-subtle text-accent' : 'bg-surface-hover text-fg-subtle')}>
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Client-side segmented control (for in-page view switches like analytics range). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode }>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-[13px]',
            value === option.value ? 'bg-surface-hover text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
