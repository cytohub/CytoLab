import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { NotFoundError } from '@/domain/errors';
import { requireServerAuth } from '@/server/auth/request';
import { getTeam } from '@/server/modules/directory/service';
import { listProjects } from '@/server/modules/projects/service';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { PageContainer } from '@/components/ui/page';
import { ProjectCard } from '@/components/projects/project-card';
import { UserCell } from '@/components/domain/misc';
import { Badge } from '@/components/ui/badge';
import { routes } from '@/lib/routes';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerAuth();
  const { id } = await params;
  const team = await getTeam(ctx, id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  const projects = await listProjects(ctx, { teamId: [id], pageSize: 12 });

  return (
    <PageContainer className="max-w-5xl">
      <nav className="mb-3 flex items-center gap-1 text-sm text-fg-subtle">
        <Link href={routes.teams} className="hover:text-fg">Teams</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-fg-muted">{team.name}</span>
      </nav>
      <div className="mb-6 flex items-center gap-3">
        <span className={`size-3 rounded-full chip-${team.color}`} aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight text-fg">{team.name}</h1>
        <Badge tone="neutral" size="sm">{pluralize(team.memberCount, 'member')}</Badge>
      </div>
      {team.description && <p className="mb-6 max-w-2xl text-sm text-fg-muted">{team.description}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-fg">Projects</h2>
          {projects.items.length === 0 ? (
            <EmptyState title="No projects" description="This team does not own any projects yet." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projects.items.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">Members</h2>
          <Card>
            <ul className="divide-y divide-border">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <UserCell user={m} href={routes.member(m.id)} size="sm" />
                  <span className="text-xs text-fg-subtle">{m.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </PageContainer>
  );
}
