import { getEntityRef } from '@/server/platform/entities';
import { listActivity } from '@/server/modules/activity/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, req, params }) => {
  await getEntityRef(ctx, params.id, { includeDeleted: true });
  const before = req.nextUrl.searchParams.get('before') ?? undefined;
  const feed = await listActivity(ctx, { entityId: params.id, limit: 30, before });
  return ok(feed.items, { nextCursor: feed.nextCursor });
});
