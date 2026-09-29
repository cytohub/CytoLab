'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useQueryParams } from './query-controls';
import { cn } from '@/lib/cn';

/** Clickable table header that cycles a `sort` URL param (asc → desc). */
export function SortHeader({ label, sortKey, defaultSort }: { label: string; sortKey: string; defaultSort?: string }) {
  const { searchParams, setParams } = useQueryParams();
  const current = searchParams.get('sort') ?? defaultSort ?? '';
  const field = current.replace(/^-/, '');
  const desc = current.startsWith('-');
  const active = field === sortKey;

  const onClick = () => {
    // asc → desc → asc …; a fresh column starts descending.
    const next = active ? (desc ? sortKey : `-${sortKey}`) : `-${sortKey}`;
    setParams({ sort: next }, { resetPage: false });
  };

  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-fg', active ? 'text-fg' : 'text-fg-subtle')}>
      {label}
      {active ? desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
    </button>
  );
}
