import { activityQuerySchema } from '@/domain/schemas/platform';
import { listActivity } from '@/server/modules/activity/service';
import { api, ok, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx, req }) => {
  const query = parseQuery(req, activityQuerySchema);
  const feed = await listActivity(ctx, query);
  return ok(feed.items, { nextCursor: feed.nextCursor });
});
