'use client';

import * as React from 'react';
import { DonutChart, TrendChart } from '@/components/charts/chart-kit';
import { formatDateShort } from '@/lib/format';
import type { DashboardData } from '@/server/modules/insights/service';

const THROUGHPUT_SERIES = [
  { key: 'started', label: 'Started', color: 'var(--chart-1)' },
  { key: 'completed', label: 'Completed', color: 'var(--chart-3)' },
];

export function ThroughputChart({ data }: { data: DashboardData['throughput'] }) {
  const rows = data.map((d) => ({ x: d.weekStart, started: d.started, completed: d.completed }));
  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        {THROUGHPUT_SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <TrendChart data={rows} series={THROUGHPUT_SERIES} xKey="x" xLabelFormat={(v) => formatDateShort(v)} height={200} />
    </div>
  );
}

export function StatusDonut({ data }: { data: DashboardData['experimentStatus'] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const donutData = data.map((d) => ({ label: d.label, value: d.count, tone: d.tone }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <DonutChart data={donutData} centerValue={total} centerLabel="experiments" size={160} />
      <ul className="grid flex-1 grid-cols-1 gap-x-4 gap-y-1.5 xs:grid-cols-2 sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full dot-${d.tone}`} aria-hidden />
            <span className="text-fg-muted">{d.label}</span>
            <span className="ml-auto font-medium tabular-nums text-fg">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
