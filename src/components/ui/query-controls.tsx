'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';
import { inputClass } from './field';

/** Reads/writes URL query params, resetting pagination when a filter changes. */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = React.useCallback(
    (updates: Record<string, string | string[] | null | undefined>, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
        else if (value) params.set(key, value);
      }
      if (resetPage) params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { searchParams, setParams };
}

/** Debounced search box wired to a URL param. */
export function SearchInput({ paramKey = 'q', placeholder = 'Search…', className }: { paramKey?: string; placeholder?: string; className?: string }) {
  const { searchParams, setParams } = useQueryParams();
  const [value, setValue] = React.useState(searchParams.get(paramKey) ?? '');
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ [paramKey]: next || null }), 220);
  };

  return (
    <div className={cn('relative flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, 'pl-9 pr-8')}
        aria-label={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-subtle hover:bg-surface-hover hover:text-fg"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Multi-select dropdown filter backed by a URL param. */
export function FilterPills({ paramKey, options, allLabel }: { paramKey: string; options: FilterOption[]; allLabel: string }) {
  const { searchParams, setParams } = useQueryParams();
  const selected = new Set(searchParams.getAll(paramKey).flatMap((v) => v.split(',')));

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setParams({ [paramKey]: next.size ? [...next].join(',') : null });
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        onClick={() => setParams({ [paramKey]: null })}
        className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-colors', selected.size === 0 ? 'bg-fg text-canvas' : 'bg-surface-hover text-fg-muted hover:text-fg')}
      >
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => toggle(option.value)}
          className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-colors', selected.has(option.value) ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-fg-muted hover:text-fg')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
