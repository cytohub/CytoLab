import { createExperimentTypeSchema } from '@/domain/schemas/platform';
import { createExperimentType, listExperimentTypes } from '@/server/modules/config/service';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => ok(await listExperimentTypes(ctx)));

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, createExperimentTypeSchema);
  return created(await createExperimentType(ctx, input));
});
