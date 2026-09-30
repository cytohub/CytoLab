import { updateProfileSchema } from '@/domain/schemas/platform';
import { toSessionInfo } from '@/server/auth/context';
import { updateProfile } from '@/server/modules/directory/service';
import { unreadNotificationCount } from '@/server/modules/notifications/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => {
  const unread = await unreadNotificationCount(ctx);
  return ok({ ...toSessionInfo(ctx), unreadNotifications: unread });
});

export const PATCH = api(async ({ ctx, req }) => {
  const input = await parseJson(req, updateProfileSchema);
  await updateProfile(ctx, input);
  return ok({ success: true });
}, { publicDemoLock: 'people' });
