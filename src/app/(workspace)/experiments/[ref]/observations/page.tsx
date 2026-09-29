import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { ObservationLog } from '@/components/experiments/managers';

export const dynamic = 'force-dynamic';

export default async function ObservationsPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);
  return <ObservationLog displayId={exp.displayId} observations={exp.observations} canEdit={exp.permissions.canEdit} />;
}
