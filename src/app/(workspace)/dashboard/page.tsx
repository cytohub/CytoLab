import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, FlaskConical } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getDashboard } from '@/server/modules/insights/service';
import { listProjects } from '@/server/modules/projects/service';
import { listExperiments } from '@/server/modules/experiments/service';
import { listActivity } from '@/server/modules/activity/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { ProgressBar } from '@/components/ui/progress';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { HealthBadge } from '@/components/domain/status';
import { ActivityList } from '@/components/domain/activity-item';
import { IdTag } from '@/components/domain/misc';
import { cn } from '@/lib/cn';
import { formatDate, pluralize } from '@/lib/format';
import { routes } from '@/lib/routes';
import { StatusDonut, ThroughputChart } from './charts';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const ACCENT_METRICS = new Set(['needs_attention', 'delayed']);

export default async function DashboardPage() {
  const ctx = await requireServerAuth();
  const firstName = ctx.user.name.replace(/^(dr|prof|mr|mrs|ms|mx)\.?\s+/i, '').split(' ')[0];

  const [dashboard, activeProjects, attention, activity] = await Promise.all([
    getDashboard(ctx),
    listProjects(ctx, { status: ['active', 'planning'], sort: { field: 'updatedAt', direction: 'desc' }, page: 1, pageSize: 6 }),
    listExperiments(ctx, { attention: true, sort: { field: 'targetDate', direction: 'asc' }, page: 1, pageSize: 6 }),
    listActivity(ctx, { limit: 7 }),
  ]);

  const projectsByHealth = [...activeProjects.items].sort((a, b) => healthRank(a.health.status) - healthRank(b.health.status));

  return (
    <PageContainer>
      <PageHeader title={`Good ${timeOfDay()}, ${firstName}`} description="Here's what's happening across your R&D programs." />

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {dashboard.metrics.map((metric) => (
          <div key={metric.key} className={cn('rounded-lg border border-border bg-surface px-4 py-3.5 shadow-card', ACCENT_METRICS.has(metric.key) && metric.value > 0 && 'border-[color:var(--tone-amber-fg)]/25')}>
            <div className="text-xs font-medium text-fg-subtle">{metric.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-fg">{metric.value}</span>
              {metric.hint && <span className="truncate text-xs text-fg-faint">{metric.hint}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Research throughput</CardTitle>
              <span className="text-xs text-fg-subtle">Last 12 weeks</span>
            </CardHeader>
            <CardContent>
              <ThroughputChart data={dashboard.throughput} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project health</CardTitle>
              <Link href={routes.projects} className="text-xs font-medium text-accent hover:underline">
                All projects
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {projectsByHealth.length === 0 ? (
                <EmptyState icon={<FlaskConical />} title="No active projects" description="Create a project to start tracking research progress." />
              ) : (
                <ul className="divide-y divide-border">
                  {projectsByHealth.map((project) => (
                    <li key={project.id}>
                      <Link href={project.href} className="group flex items-center gap-4 py-3 transition-colors hover:bg-surface-hover/60">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <IdTag>{project.code}</IdTag>
                            <span className="truncate text-sm font-medium text-fg group-hover:text-accent">{project.name}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <ProgressBar value={project.progressPercent} tone={project.health.tone as 'green' | 'amber' | 'red' | 'muted'} size="sm" className="max-w-40" />
                            <span className="text-xs tabular-nums text-fg-subtle">{project.progressPercent}%</span>
                          </div>
                        </div>
                        <div className="hidden shrink-0 text-right sm:block">
                          <div className="text-xs text-fg-subtle">{pluralize(project.openExperimentCount, 'open experiment')}</div>
                          {project.needsAttentionCount > 0 && <div className="text-xs text-[color:var(--tone-amber-fg)]">{pluralize(project.needsAttentionCount, 'need')} attention</div>}
                        </div>
                        <HealthBadge health={project.health} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Link href={routes.activity} className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {activity.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-fg-muted">No recent activity.</p>
              ) : (
                <ActivityList items={activity.items} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Experiments by status</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.experimentStatus.length === 0 ? (
                <p className="py-6 text-center text-sm text-fg-muted">No experiments yet.</p>
              ) : (
                <StatusDonut data={dashboard.experimentStatus} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-[var(--tone-amber-fg)]" /> Needs attention
              </CardTitle>
              <Link href={`${routes.experiments}?attention=true`} className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {attention.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-fg-muted">Nothing needs attention. 🎉</p>
              ) : (
                <ul className="divide-y divide-border">
                  {attention.items.map((exp) => (
                    <li key={exp.id}>
                      <Link href={exp.href} className="group block py-2.5">
                        <div className="flex items-center gap-2">
                          <IdTag>{exp.displayId}</IdTag>
                          <span className="truncate text-sm font-medium text-fg group-hover:text-accent">{exp.name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={cn('text-xs', exp.attention.severity === 'high' ? 'text-[var(--tone-red-fg)]' : 'text-[var(--tone-amber-fg)]')}>
                            {exp.attention.reasons[0]?.message}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <CalendarClock className="size-4 text-fg-subtle" /> Upcoming milestones
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {dashboard.upcomingMilestones.length === 0 ? (
                <p className="py-6 text-center text-sm text-fg-muted">No upcoming milestones.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {dashboard.upcomingMilestones.map((m) => (
                    <li key={m.id} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle">{m.displayId}</span>
                        <span className="truncate text-sm font-medium text-fg">{m.title}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <Link href={m.project.href} className="truncate text-xs text-fg-subtle hover:underline">
                          {m.project.code}
                        </Link>
                        <span className={cn('text-xs', m.overdue ? 'text-[var(--tone-red-fg)]' : 'text-fg-subtle')}>
                          {m.overdue ? 'Overdue · ' : ''}
                          {m.dueDate ? formatDate(m.dueDate) : 'No date'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function healthRank(status: string): number {
  return { off_track: 0, at_risk: 1, on_track: 2, inactive: 3 }[status] ?? 4;
}
function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
