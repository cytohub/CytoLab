'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQueryParams } from './query-controls';
import { Button } from './button';

export function Pagination({ page, totalPages, total, pageSize }: { page: number; totalPages: number; total: number; pageSize: number }) {
  const { setParams } = useQueryParams();
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-sm">
      <span className="text-fg-subtle">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) }, { resetPage: false })}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <span className="px-2 text-xs text-fg-subtle">
          {page} / {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setParams({ page: String(page + 1) }, { resetPage: false })}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
