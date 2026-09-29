import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, CalendarDays, Users } from 'lucide-react';
import { NotFoundError } from '@/domain/errors';
import { requireServerAuth } from '@/server/auth/request';
import { getProject } from '@/server/modules/projects/service';
import { PageContainer } from '@/components/ui/page';
import { TabsNav } from '@/components/ui/tabs-nav';
import { PriorityIndicator } from '@/components/domain/status';
import { ColorLabel, IdTag, UserCell } from '@/components/domain/misc';
import { ProjectHeaderActions } from '@/components/projects/project-header';
import { formatDate } from '@/lib/format';
import { routes } from '@/lib/routes';

export default async function ProjectLayout({ params, children }: { params: Promise<{ ref: string }>; children: React.ReactNode }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const project = await getProject(ctx, ref).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });

  const base = routes.project(project.code);
  const tabs = [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/experiments`, label: 'Experiments', count: project.experimentCount },
    { href: `${base}/milestones`, label: 'Milestones', count: project.milestones.length },
    { href: `${base}/activity`, label: 'Activity' },
  ];

  return (
    <PageContainer>
      <nav className="mb-3 flex items-center gap-1 text-sm text-fg-subtle">
        <Link href={routes.projects} className="hover:text-fg">Projects</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-fg-muted">{project.code}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <IdTag className="text-sm">{project.code}</IdTag>
            <PriorityIndicator priority={project.priority} withLabel />
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">{project.name}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <UserCell user={project.owner} size="xs" muted />
            {project.team && <ColorLabel color={project.team.color}><Users className="mr-1 inline size-3.5" />{project.team.name}</ColorLabel>}
            {project.researchArea && <ColorLabel color={project.researchArea.color}>{project.researchArea.name}</ColorLabel>}
            {project.targetDate && (
              <span className="inline-flex items-center gap-1.5 text-fg-muted">
                <CalendarDays className="size-3.5 text-fg-subtle" /> Due {formatDate(project.targetDate)}
              </span>
            )}
          </div>
        </div>
        <ProjectHeaderActions project={project} />
      </div>

      <div className="mt-5">
        <TabsNav tabs={tabs} />
      </div>

      <div className="py-6">{children}</div>
    </PageContainer>
  );
}
