import { FlaskConical } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getProject } from '@/server/modules/projects/service';
import { listExperimentsForProject } from '@/server/modules/experiments/service';
import { EmptyState } from '@/components/ui/feedback';
import { Card } from '@/components/ui/card';
import { ExperimentTable } from '@/components/experiments/experiment-table';

export const dynamic = 'force-dynamic';

export default async function ProjectExperimentsPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const project = await getProject(ctx, ref);
  const experiments = await listExperimentsForProject(ctx, project.id);

  if (experiments.length === 0) {
    return <EmptyState icon={<FlaskConical />} title="No experiments yet" description="Experiments in this project will appear here." />;
  }

  return (
    <Card className="overflow-hidden">
      <ExperimentTable experiments={experiments} columns={['type', 'researcher', 'status', 'priority', 'target', 'tags']} />
    </Card>
  );
}
