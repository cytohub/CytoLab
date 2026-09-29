import { updateExperimentSchema } from '@/domain/schemas/experiments';
import { getExperimentDetail } from '@/server/modules/experiments/detail';
import { resolveExperimentId } from '@/server/modules/experiments/service';
import { deleteExperiment, updateExperiment } from '@/server/modules/experiments/mutations';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ ref: string }>(async ({ ctx, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  return ok(await getExperimentDetail(ctx, id));
});

export const PATCH = api<{ ref: string }>(async ({ ctx, req, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  const input = await parseJson(req, updateExperimentSchema);
  return ok(await updateExperiment(ctx, id, input));
});

export const DELETE = api<{ ref: string }>(async ({ ctx, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  await deleteExperiment(ctx, id);
  return ok({ success: true });
});
