import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { ProtocolSteps } from '@/components/experiments/managers';

export const dynamic = 'force-dynamic';

export default async function ProtocolPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);
  return <ProtocolSteps displayId={exp.displayId} steps={exp.steps} canEdit={exp.permissions.canEdit} />;
}
