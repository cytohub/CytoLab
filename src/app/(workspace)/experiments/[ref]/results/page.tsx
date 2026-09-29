import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { ResultsManager } from '@/components/experiments/managers';

export const dynamic = 'force-dynamic';

export default async function ResultsPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);
  return <ResultsManager displayId={exp.displayId} results={exp.results} canEdit={exp.permissions.canEdit} />;
}
