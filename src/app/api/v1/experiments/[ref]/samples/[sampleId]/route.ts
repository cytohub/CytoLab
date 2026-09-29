import { EXPERIMENT_SAMPLE_ROLES } from '@/domain/enums';
import { resolveExperimentId } from '@/server/modules/experiments/service';
import { unlinkSample } from '@/server/modules/experiments/sub-records';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = api<{ ref: string; sampleId: string }>(async ({ ctx, req, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  const roleParam = req.nextUrl.searchParams.get('role') ?? 'input';
  const role = (EXPERIMENT_SAMPLE_ROLES as readonly string[]).includes(roleParam) ? roleParam : 'input';
  await unlinkSample(ctx, id, params.sampleId, role);
  return ok({ success: true });
});
