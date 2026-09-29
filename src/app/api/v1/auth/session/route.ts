import { toSessionInfo } from '@/server/auth/context';
import { ok, publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = publicApi(async ({ ctx }) => {
  return ok({ authenticated: ctx !== null, session: ctx ? toSessionInfo(ctx) : null });
});
