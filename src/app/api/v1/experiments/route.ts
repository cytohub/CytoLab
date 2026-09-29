import { createExperimentSchema, listExperimentsQuerySchema } from '@/domain/schemas/experiments';
import { listExperiments } from '@/server/modules/experiments/service';
import { createExperiment } from '@/server/modules/experiments/mutations';
import { api, created, ok, parseJson, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx, req }) => {
  const query = parseQuery(req, listExperimentsQuerySchema);
  const { items, meta } = await listExperiments(ctx, query);
  return ok(items, meta);
});

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, createExperimentSchema);
  return created(await createExperiment(ctx, input));
});
