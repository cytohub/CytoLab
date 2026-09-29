import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { NotFoundError } from '@/domain/errors';
import { requireServerAuth } from '@/server/auth/request';
import { getExperimentDetail } from '@/server/modules/experiments/detail';
import { resolveExperimentId } from '@/server/modules/experiments/service';
import { PageContainer } from '@/components/ui/page';
import { TabsNav } from '@/components/ui/tabs-nav';
import { PriorityIndicator } from '@/components/domain/status';
import { ColorLabel, IdTag, TagList, UserCell } from '@/components/domain/misc';
import { ExperimentStatusButton, ExperimentMenu } from '@/components/experiments/experiment-actions';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { routes } from '@/lib/routes';

export default async function ExperimentLayout({ params, children }: { params: Promise<{ ref: string }>; children: React.ReactNode }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const id = await resolveExperimentId(ctx, ref).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  const exp = await getExperimentDetail(ctx, id);

  const base = routes.experiment(exp.displayId);
  const tabs = [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/protocol`, label: 'Protocol', count: exp.counts.steps || null },
    { href: `${base}/inputs`, label: 'Inputs', count: exp.counts.inputs || null },
    { href: `${base}/samples`, label: 'Samples', count: exp.counts.samples || null },
    { href: `${base}/observations`, label: 'Observations', count: exp.counts.observations || null },
    { href: `${base}/results`, label: 'Results', count: exp.counts.results || null },
    { href: `${base}/files`, label: 'Files' },
    { href: `${base}/activity`, label: 'Activity' },
  ];

  return (
    <PageContainer>
      <nav className="mb-3 flex items-center gap-1 text-sm text-fg-subtle">
        <Link href={routes.experiments} className="hover:text-fg">Experiments</Link>
        <ChevronRight className="size-3.5" />
        <Link href={exp.project.href} className="hover:text-fg">{exp.project.code}</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-fg-muted">{exp.displayId}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <IdTag className="text-sm">{exp.displayId}</IdTag>
            <PriorityIndicator priority={exp.priority} withLabel />
            {exp.attention.needsAttention && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tone-amber-bg)] px-2 py-0.5 text-xs font-medium text-[color:var(--tone-amber-fg)]">
                <AlertTriangle className="size-3.5" /> Needs attention
              </span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">{exp.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExperimentStatusButton experiment={exp} />
          <ExperimentMenu experiment={exp} />
        </div>
      </div>

      {/* Property strip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <Prop label="Project"><Link href={exp.project.href} className="font-medium text-fg hover:text-accent hover:underline">{exp.project.code}</Link></Prop>
        <Prop label="Type"><ColorLabel color={exp.experimentType.color}>{exp.experimentType.name}</ColorLabel></Prop>
        <Prop label="Researcher"><UserCell user={exp.researcher} size="xs" /></Prop>
        {exp.team && <Prop label="Team"><ColorLabel color={exp.team.color}>{exp.team.name}</ColorLabel></Prop>}
        <Prop label="Start"><span className="text-fg-muted">{formatDate(exp.startDate)}</span></Prop>
        <Prop label="Target"><span className={cn(exp.attention.reasons.some((r) => r.code === 'overdue') ? 'text-[var(--tone-red-fg)]' : 'text-fg-muted')}>{formatDate(exp.targetDate)}</span></Prop>
        {exp.completedDate && <Prop label="Completed"><span className="text-fg-muted">{formatDate(exp.completedDate)}</span></Prop>}
        {exp.protocolRef && <Prop label="Protocol"><span className="inline-flex items-center gap-1 text-fg-muted"><FileText className="size-3.5 text-fg-subtle" />{exp.protocolRef}</span></Prop>}
        {exp.tags.length > 0 && <Prop label="Tags"><TagList tags={exp.tags} /></Prop>}
      </div>

      {exp.blockedReason && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--tone-red-fg)]/25 bg-[var(--tone-red-bg)] px-3 py-2 text-sm text-[color:var(--tone-red-fg)]">
          <AlertTriangle className="size-4 shrink-0" /> <strong className="font-medium">Blocked:</strong> {exp.blockedReason}
        </div>
      )}

      <div className="mt-5">
        <TabsNav tabs={tabs} />
      </div>
      <div className="py-6">{children}</div>
    </PageContainer>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-fg-subtle">{label}</span>
      {children}
    </div>
  );
}
