import { searchQuerySchema } from '@/domain/schemas/platform';
import { search } from '@/server/modules/search/service';
import { api, ok, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx, req }) => {
  const query = parseQuery(req, searchQuerySchema);
  return ok(await search(ctx, query));
});
