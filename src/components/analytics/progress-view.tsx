'use client';

import Link from 'next/link';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/tabs-nav';
import { Spinner } from '@/components/ui/feedback';
import { BarList, DonutChart, TrendChart } from '@/components/charts/chart-kit';
import { api, errorMessage } from '@/lib/api-client';
import { formatDateShort } from '@/lib/format';
import { toast } from '@/components/ui/toast';
import type { AnalyticsData } from '@/server/modules/insights/service';

const RANGES = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '180d', label: '180d' },
  { value: '365d', label: '1y' },
] as const;

const THROUGHPUT_SERIES = [
  { key: 'started', label: 'Started', color: 'var(--chart-1)' },
  { key: 'completed', label: 'Completed', color: 'var(--chart-3)' },
];

export function ProgressView({ initial }: { initial: AnalyticsData }) {
  const [data, setData] = React.useState(initial);
  const [range, setRange] = React.useState<string>(initial.range);
  const [granularity, setGranularity] = React.useState<string>(initial.granularity);
  const [loading, setLoading] = React.useState(false);

  const refetch = React.useCallback(async (nextRange: string, nextGran: string) => {
    setLoading(true);
    try {
      const { data: fresh } = await api.get<AnalyticsData>('/analytics/progress', { range: nextRange, granularity: nextGran });
      setData(fresh);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRange = (r: string) => { setRange(r); void refetch(r, granularity); };
  const onGran = (g: string) => { setGranularity(g); void refetch(range, g); };

  const trendRows = data.throughput.map((t) => ({ x: t.periodStart, started: t.started, completed: t.completed }));
  const successData = [
    { label: 'Completed', value: data.successRate.completed, tone: 'green' },
    { label: 'Failed', value: data.successRate.failed, tone: 'red' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl value={range} onChange={onRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        <div className="flex items-center gap-2">
          {loading && <Spinner />}
          <SegmentedControl value={granularity} onChange={onGran} options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} size="sm" />
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Success rate" value={data.successRate.ratePercent != null ? `${data.successRate.ratePercent}%` : '—'} hint={`${data.successRate.completed} completed · ${data.successRate.failed} failed`} />
        <Stat label="Median time to complete" value={data.timeToCompletion.medianDays != null ? `${data.timeToCompletion.medianDays}d` : '—'} hint={`${data.timeToCompletion.sampleSize} experiments`} />
        <Stat label="Milestones reached" value={`${data.milestoneCompletion.completed}/${data.milestoneCompletion.total}`} hint="all projects" />
        <Stat label="Avg. time to complete" value={data.timeToCompletion.averageDays != null ? `${data.timeToCompletion.averageDays}d` : '—'} hint="start → completed" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
            <div className="flex items-center gap-3">
              {THROUGHPUT_SERIES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} /> {s.label}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendRows} series={THROUGHPUT_SERIES} xKey="x" xLabelFormat={(v) => formatDateShort(v)} height={240} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Success vs failure</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center">
            {data.successRate.completed + data.successRate.failed === 0 ? (
              <p className="py-8 text-sm text-fg-muted">No concluded experiments in range.</p>
            ) : (
              <>
                <DonutChart data={successData} centerValue={data.successRate.ratePercent != null ? `${data.successRate.ratePercent}%` : '—'} centerLabel="success" size={160} />
                <ul className="mt-3 flex gap-4">
                  {successData.map((d) => (
                    <li key={d.label} className="flex items-center gap-1.5 text-sm">
                      <span className={`size-2 rounded-full dot-${d.tone}`} /> <span className="text-fg-muted">{d.label}</span> <span className="font-medium text-fg">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>By experiment type</CardTitle></CardHeader>
          <CardContent>
            {data.byType.length === 0 ? <Empty /> : <BarList items={data.byType.map((t) => ({ label: t.name, value: t.count }))} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By researcher</CardTitle></CardHeader>
          <CardContent>
            {data.byResearcher.length === 0 ? <Empty /> : <BarList items={data.byResearcher.map((r) => ({ label: r.name, value: r.count }))} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By project</CardTitle></CardHeader>
          <CardContent>
            {data.byProject.length === 0 ? (
              <Empty />
            ) : (
              <BarList items={data.byProject.map((p) => ({ label: <Link href={p.href} className="hover:text-accent hover:underline">{p.code}</Link>, value: p.count, hint: `${p.completed} done` }))} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5 shadow-card">
      <div className="text-xs font-medium text-fg-subtle">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-fg-faint">{hint}</div>}
    </div>
  );
}
function Empty() {
  return <p className="py-6 text-center text-sm text-fg-muted">No data in range.</p>;
}
