'use client';

import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { SearchInput, FilterPills, useQueryParams } from '@/components/ui/query-controls';
import { EXPERIMENT_STATUSES } from '@/domain/enums';
import { EXPERIMENT_STATUS_META } from '@/domain/labels';
import { cn } from '@/lib/cn';

const STATUS_OPTIONS = EXPERIMENT_STATUSES.filter((s) => s !== 'archived').map((s) => ({ value: s, label: EXPERIMENT_STATUS_META[s].label }));

export function ExperimentsToolbar() {
  const { searchParams, setParams } = useQueryParams();
  const attention = searchParams.get('attention') === 'true';

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search experiments…" className="sm:max-w-xs" />
        <button
          onClick={() => setParams({ attention: attention ? null : 'true' })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            attention ? 'border-[color:var(--tone-amber-fg)]/40 bg-[var(--tone-amber-bg)] text-[color:var(--tone-amber-fg)]' : 'border-border text-fg-muted hover:text-fg',
          )}
        >
          <AlertTriangle className="size-4" /> Needs attention
        </button>
      </div>
      <FilterPills paramKey="status" options={STATUS_OPTIONS} allLabel="All statuses" />
    </div>
  );
}
