import type { Metadata } from 'next';
import { FolderKanban, Plus } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { listProjects } from '@/server/modules/projects/service';
import { listProjectsQuerySchema } from '@/domain/schemas/projects';
import { PROJECT_STATUSES } from '@/domain/enums';
import { PROJECT_STATUS_META } from '@/domain/labels';
import { can } from '@/server/authz';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { DialogTrigger } from '@/components/ui/dialog';
import { SearchInput, FilterPills } from '@/components/ui/query-controls';
import { CreateProjectDialog } from '@/components/forms/project-form-dialog';
import { ProjectCard } from '@/components/projects/project-card';
import { pluralize } from '@/lib/format';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = PROJECT_STATUSES.filter((s) => s !== 'archived').map((s) => ({ value: s, label: PROJECT_STATUS_META[s].label }));

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireServerAuth();
  const params = await searchParams;
  const query = listProjectsQuerySchema.parse(normalize(params));
  const { items, meta } = await listProjects(ctx, query);
  const canCreate = can(ctx, 'project:create');

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description={`${pluralize(meta.total, 'project')} in your workspace`}
        actions={
          canCreate ? (
            <CreateProjectDialog
              trigger={
                <DialogTrigger asChild>
                  <Button>
                    <Plus /> New project
                  </Button>
                </DialogTrigger>
              }
            />
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search projects…" className="sm:max-w-xs" />
        <FilterPills paramKey="status" options={STATUS_OPTIONS} allLabel="All statuses" />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title={query.q || query.status?.length ? 'No matching projects' : 'No projects yet'}
          description={query.q || query.status?.length ? 'Try adjusting your search or filters.' : 'Create your first project to start tracking research.'}
          action={
            canCreate && !query.q && !query.status?.length ? (
              <CreateProjectDialog
                trigger={
                  <DialogTrigger asChild>
                    <Button>
                      <Plus /> New project
                    </Button>
                  </DialogTrigger>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Coerces repeated/absent query params into the shape the schema expects. */
function normalize(params: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return out;
}
