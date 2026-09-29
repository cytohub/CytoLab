import { resultSchema } from '@/domain/schemas/experiments';
import { resolveExperimentId } from '@/server/modules/experiments/service';
import { addResult } from '@/server/modules/experiments/sub-records';
import { api, created, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api<{ ref: string }>(async ({ ctx, req, params }) => {
  const id = await resolveExperimentId(ctx, params.ref);
  const input = await parseJson(req, resultSchema);
  return created(await addResult(ctx, id, input));
});
