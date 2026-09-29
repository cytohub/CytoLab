import type { Metadata } from 'next';
import { FlaskConical, Plus } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { listExperiments } from '@/server/modules/experiments/service';
import { listExperimentsQuerySchema } from '@/domain/schemas/experiments';
import { can } from '@/server/authz';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { DialogTrigger } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { CreateExperimentDialog } from '@/components/forms/create-experiment-dialog';
import { ExperimentsToolbar } from '@/components/experiments/experiments-toolbar';
import { ExperimentTable } from '@/components/experiments/experiment-table';
import { pluralize } from '@/lib/format';

export const metadata: Metadata = { title: 'Experiments' };
export const dynamic = 'force-dynamic';

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireServerAuth();
  const params = await searchParams;
  const query = listExperimentsQuerySchema.parse(normalize(params));
  const { items, meta } = await listExperiments(ctx, query);
  const canCreate = can(ctx, 'experiment:create');
  const filtered = Boolean(query.q || query.status?.length || query.attention || query.projectId?.length || query.researcherId?.length);

  const createButton = (
    <CreateExperimentDialog
      trigger={
        <DialogTrigger asChild>
          <Button>
            <Plus /> New experiment
          </Button>
        </DialogTrigger>
      }
    />
  );

  return (
    <PageContainer>
      <PageHeader title="Experiments" description={`${pluralize(meta.total, 'experiment')} across your projects`} actions={canCreate ? createButton : undefined} />

      <ExperimentsToolbar />

      {items.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title={filtered ? 'No matching experiments' : 'No experiments yet'}
          description={filtered ? 'Try adjusting your search or filters.' : 'Create your first experiment to start tracking research.'}
          action={canCreate && !filtered ? createButton : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <ExperimentTable
            experiments={items}
            columns={['project', 'type', 'researcher', 'status', 'priority', 'target', 'tags']}
            sortColumn={(col) => <SortHeader label={col.label} sortKey={col.sortKey!} defaultSort="-updatedAt" />}
          />
          <div className="px-4 pb-3">
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} />
          </div>
        </Card>
      )}
    </PageContainer>
  );
}

function normalize(params: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return out;
}
