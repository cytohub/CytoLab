import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getProject } from '@/server/modules/projects/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { HealthBadge } from '@/components/domain/status';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: `${ref} · Project` };
}

export default async function ProjectOverviewPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const project = await getProject(ctx, ref);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {project.description && (
          <Card>
            <CardHeader><CardTitle>About</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{project.description}</p></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <Link href={`/projects/${project.code}/milestones`} className="text-xs font-medium text-accent hover:underline">Manage</Link>
          </CardHeader>
          <CardContent className="pt-0">
            {project.milestones.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-muted">No milestones defined yet.</p>
            ) : (
              <ol className="relative space-y-1">
                {project.milestones.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-1.5">
                    <span className="mt-0.5">
                      {m.status.value === 'completed' ? (
                        <CheckCircle2 className="size-4.5 text-[var(--tone-green-fg)]" />
                      ) : m.overdue ? (
                        <AlertCircle className="size-4.5 text-[var(--tone-red-fg)]" />
                      ) : (
                        <Circle className={cn('size-4.5', m.status.value === 'in_progress' ? 'text-[var(--tone-blue-fg)]' : 'text-fg-faint')} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle">{m.displayId}</span>
                        <span className={cn('text-sm font-medium', m.status.value === 'completed' ? 'text-fg-muted line-through' : 'text-fg')}>{m.title}</span>
                      </div>
                      {m.description && <p className="mt-0.5 text-xs text-fg-muted">{m.description}</p>}
                    </div>
                    <span className={cn('shrink-0 text-xs', m.overdue ? 'text-[var(--tone-red-fg)]' : 'text-fg-subtle')}>
                      {m.completedAt ? `Reached ${formatDate(m.completedAt.slice(0, 10))}` : m.dueDate ? `Due ${formatDate(m.dueDate)}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {project.notes && (
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{project.notes}</p></CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Progress</CardTitle><HealthBadge health={project.health} size="sm" /></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums text-fg">{project.progressPercent}%</span>
                <span className="text-xs text-fg-subtle capitalize">by {project.progressBasis}</span>
              </div>
              <ProgressBar value={project.progressPercent} tone={project.health.tone as 'green' | 'amber' | 'red' | 'muted'} markerAt={project.health.expectedPercent} />
              {project.health.expectedPercent != null && (
                <p className="mt-1.5 text-xs text-fg-subtle">Expected ~{project.health.expectedPercent}% by now (marker)</p>
              )}
            </div>
            {project.health.reasons.length > 0 && (
              <ul className="space-y-1 border-t border-border pt-3">
                {project.health.reasons.map((r, i) => (
                  <li key={i} className={cn('flex items-center gap-2 text-xs', r.severity === 'off_track' ? 'text-[var(--tone-red-fg)]' : 'text-[var(--tone-amber-fg)]')}>
                    <AlertCircle className="size-3.5 shrink-0" /> {r.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Experiments</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {project.experimentStatusBreakdown.length === 0 ? (
              <p className="py-4 text-center text-sm text-fg-muted">No experiments yet.</p>
            ) : (
              <ul className="space-y-2">
                {project.experimentStatusBreakdown.map((s) => (
                  <li key={s.status} className="flex items-center gap-2 text-sm">
                    <span className={`size-2 rounded-full dot-${s.tone}`} />
                    <span className="text-fg-muted">{s.label}</span>
                    <span className="ml-auto font-medium tabular-nums text-fg">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="Start date" value={formatDate(project.startDate)} />
            <Detail label="Target date" value={formatDate(project.targetDate)} />
            <Detail label="Created" value={formatDate(project.createdAt.slice(0, 10))} />
            <Detail label="Attention" value={project.needsAttentionCount > 0 ? `${project.needsAttentionCount} experiments` : 'None'} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium text-fg">{value}</dd>
    </div>
  );
}
