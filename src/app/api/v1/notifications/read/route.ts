import { markNotificationsSchema } from '@/domain/schemas/platform';
import { markNotifications } from '@/server/modules/notifications/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, markNotificationsSchema);
  return ok(await markNotifications(ctx, input));
});
