import { updateStepSchema } from '@/domain/schemas/experiments';
import { resolveExperimentId } from '@/server/modules/experiments/service';
import { updateStep, deleteStep } from '@/server/modules/experiments/sub-records';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api<{ ref: string; itemId: string }>(async ({ ctx, req, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  const input = await parseJson(req, updateStepSchema);
  return ok(await updateStep(ctx, id, params.itemId, input));
});

export const DELETE = api<{ ref: string; itemId: string }>(async ({ ctx, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  await deleteStep(ctx, id, params.itemId);
  return ok({ success: true });
});
