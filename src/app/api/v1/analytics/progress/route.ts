import { analyticsQuerySchema } from '@/domain/schemas/platform';
import { getAnalytics } from '@/server/modules/insights/service';
import { api, ok, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx, req }) => {
  const query = parseQuery(req, analyticsQuerySchema);
  return ok(await getAnalytics(ctx, query));
});
