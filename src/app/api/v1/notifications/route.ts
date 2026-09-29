import { notificationsQuerySchema } from '@/domain/schemas/platform';
import { listNotifications } from '@/server/modules/notifications/service';
import { api, ok, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx, req }) => {
  const query = parseQuery(req, notificationsQuerySchema);
  const result = await listNotifications(ctx, query);
  return ok(result.items, { nextCursor: result.nextCursor, unreadCount: result.unreadCount });
});
