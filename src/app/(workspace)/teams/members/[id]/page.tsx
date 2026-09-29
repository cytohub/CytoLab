import { notFound } from 'next/navigation';
import { Mail } from 'lucide-react';
import { NotFoundError } from '@/domain/errors';
import { requireServerAuth } from '@/server/auth/request';
import { getMember } from '@/server/modules/directory/service';
import { listExperiments } from '@/server/modules/experiments/service';
import { listProjects } from '@/server/modules/projects/service';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { PageContainer } from '@/components/ui/page';
import { ExperimentTable } from '@/components/experiments/experiment-table';
import { ProjectCard } from '@/components/projects/project-card';
import { ColorLabel } from '@/components/domain/misc';
import { ROLE_META } from '@/domain/labels';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerAuth();
  const { id } = await params;
  const member = await getMember(ctx, id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });

  const [experiments, projects] = await Promise.all([
    listExperiments(ctx, { researcherId: [id], sort: { field: 'updatedAt', direction: 'desc' }, pageSize: 10 }),
    listProjects(ctx, { ownerId: [id], pageSize: 6 }),
  ]);

  return (
    <PageContainer className="max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={member.name} initials={member.initials} color={member.avatarColor} avatarUrl={member.avatarUrl} size="xl" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">{member.name}</h1>
          {member.title && <p className="text-sm text-fg-muted">{member.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">{ROLE_META[member.role.value].label}</Badge>
            <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg">
              <Mail className="size-3.5" /> {member.email}
            </a>
            {member.teams.map((t) => <ColorLabel key={t.id} color={t.color} className="text-xs">{t.name}</ColorLabel>)}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">Owned projects</h2>
          {projects.items.length === 0 ? (
            <EmptyState title="No owned projects" description={`${member.name} does not own any projects yet.`} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.items.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">Recent experiments · {pluralize(experiments.meta.total, 'total')}</h2>
          {experiments.items.length === 0 ? (
            <EmptyState title="No experiments" description={`${member.name} is not assigned to any experiments yet.`} />
          ) : (
            <Card className="overflow-hidden">
              <ExperimentTable experiments={experiments.items} columns={['project', 'type', 'status', 'target']} />
            </Card>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
