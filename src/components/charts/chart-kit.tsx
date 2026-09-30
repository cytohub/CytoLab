'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { evenTicks } from '@/lib/chart-ticks';
import { cn } from '@/lib/cn';

/** Series colors reference the validated chart palette (theme-adaptive via CSS vars). */
export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'] as const;

const toneColor: Record<string, string> = {
  neutral: 'var(--tone-neutral-fg)',
  blue: 'var(--tone-blue-fg)',
  green: 'var(--tone-green-fg)',
  red: 'var(--tone-red-fg)',
  amber: 'var(--tone-amber-fg)',
  violet: 'var(--tone-violet-fg)',
  muted: 'var(--tone-muted-fg)',
};

interface TooltipRow {
  label: string;
  value: React.ReactNode;
  color?: string;
}

function ChartTooltip({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-panel px-2.5 py-2 text-xs shadow-popover">
      {title && <div className="mb-1 font-medium text-fg">{title}</div>}
      <div className="space-y-0.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {row.color && <span className="size-2 rounded-[2px]" style={{ background: row.color }} />}
            <span className="text-fg-muted">{row.label}</span>
            <span className="ml-auto font-medium tabular-nums text-fg">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend (area) chart — up to a few series over time. Legend is rendered by the
// caller (card header); axes and grid are recessive.
// ---------------------------------------------------------------------------

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

export function TrendChart({
  data,
  series,
  xKey,
  xLabelFormat,
  height = 200,
  valueSuffix,
}: {
  data: Array<Record<string, number | string>>;
  series: TrendSeries[];
  xKey: string;
  xLabelFormat?: (value: string) => string;
  height?: number;
  valueSuffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* Right margin leaves room for the latest period's centred label. */}
      <AreaChart data={data} margin={{ top: 6, right: 22, bottom: 0, left: -18 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <XAxis
          dataKey={xKey}
          tickFormatter={xLabelFormat}
          tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--chart-grid)' }}
          tickLine={false}
          ticks={evenTicks(data.map((d) => String(d[xKey])))}
          interval={0}
        />
        <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: 'var(--chart-grid)', strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <ChartTooltip
                title={xLabelFormat ? xLabelFormat(String(label)) : String(label)}
                rows={payload.map((p) => ({
                  label: series.find((s) => s.key === p.dataKey)?.label ?? String(p.dataKey),
                  value: `${p.value}${valueSuffix ?? ''}`,
                  color: String(p.color),
                }))}
              />
            ) : null
          }
        />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Donut — a distribution with a center total. Slices carry a 2px surface gap.
// Identity is never color-alone: a legend with counts accompanies it.
// ---------------------------------------------------------------------------

export interface DonutDatum {
  label: string;
  value: number;
  tone?: string;
  color?: string;
}

export function DonutChart({ data, centerLabel, centerValue, size = 168 }: { data: DonutDatum[]; centerLabel?: string; centerValue?: number | string; size?: number }) {
  const colored = data.map((d, i) => ({ ...d, fill: d.color ?? (d.tone ? toneColor[d.tone] : undefined) ?? CHART_COLORS[i % CHART_COLORS.length] }));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={colored} dataKey="value" nameKey="label" innerRadius={size * 0.32} outerRadius={size * 0.48} paddingAngle={2} stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270}>
            {colored.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <ChartTooltip rows={[{ label: String(payload[0]!.name), value: payload[0]!.value as number, color: String((payload[0]!.payload as { fill: string }).fill) }]} />
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue !== undefined || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== undefined && <span className="text-2xl font-semibold tabular-nums text-fg">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-fg-muted">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal magnitude bars (single hue; identity is the row label, not color).
// ---------------------------------------------------------------------------

export function BarList({
  items,
  className,
  valueFormat,
}: {
  items: Array<{ label: React.ReactNode; value: number; href?: string; hint?: string; color?: string }>;
  className?: string;
  valueFormat?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, i) => (
        <div key={i} className="group relative flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-y-0 left-0 rounded-md bg-accent-subtle transition-[width] duration-500" style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color ?? 'var(--accent-subtle)' }} />
            <div className="relative flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="truncate text-sm text-fg">{item.label}</span>
              {item.hint && <span className="shrink-0 text-xs text-fg-subtle">{item.hint}</span>}
            </div>
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-fg-muted">{valueFormat ? valueFormat(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  );
}
