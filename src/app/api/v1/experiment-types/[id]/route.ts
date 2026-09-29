import { updateExperimentTypeSchema } from '@/domain/schemas/platform';
import { updateExperimentType } from '@/server/modules/config/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api<{ id: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, updateExperimentTypeSchema);
  return ok(await updateExperimentType(ctx, params.id, input));
});
