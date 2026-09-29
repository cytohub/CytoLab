import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getTimeline, type TimelineEvent } from '@/server/modules/insights/service';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { IdTag } from '@/components/domain/misc';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { todayIn } from '@/domain/dates';

export const metadata: Metadata = { title: 'Timeline' };
export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  experiment_started: 'Started',
  experiment_completed: 'Completed',
  experiment_failed: 'Failed',
  milestone: 'Milestone',
  project_started: 'Project started',
};

export default async function TimelinePage() {
  const ctx = await requireServerAuth();
  const timeline = await getTimeline(ctx, { projectId: [] });
  const today = todayIn(ctx.org.timezone);

  // Group by day, newest first.
  const byDay = new Map<string, TimelineEvent[]>();
  for (const event of [...timeline.events].reverse()) {
    const list = byDay.get(event.date) ?? [];
    list.push(event);
    byDay.set(event.date, list);
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Timeline" description={`Experiments, milestones and key events · ${formatDate(timeline.from)} – ${formatDate(timeline.to)}`} />

      {byDay.size === 0 ? (
        <EmptyState icon={<CalendarRange />} title="Nothing on the timeline" description="Experiment activity and milestones will appear here as work progresses." />
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([date, events]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-fg">{formatDate(date)}</h2>
                {date === today && <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent">Today</span>}
                {date > today && <span className="text-[11px] text-fg-faint">upcoming</span>}
              </div>
              <Card>
                <ul className="divide-y divide-border">
                  {events.map((event) => (
                    <li key={event.id}>
                      <Link href={event.href} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover">
                        <span className={cn('size-2 shrink-0 rounded-full', `dot-${event.tone}`)} aria-hidden />
                        <span className="w-20 shrink-0 text-xs font-medium text-fg-subtle">{KIND_LABEL[event.kind]}</span>
                        {event.displayId && <IdTag className="shrink-0">{event.displayId}</IdTag>}
                        <span className="min-w-0 flex-1 truncate text-sm text-fg group-hover:text-accent">{event.title}</span>
                        {event.project && <span className="hidden shrink-0 text-xs text-fg-faint sm:inline">{event.project.code}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
