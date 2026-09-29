import { cookies } from 'next/headers';
import { loginSchema } from '@/domain/schemas/platform';
import { resolveSession, sessionCookieName, sessionCookieOptions } from '@/server/auth/sessions';
import { toSessionInfo } from '@/server/auth/context';
import { requestMeta } from '@/server/auth/request';
import { login } from '@/server/modules/auth/service';
import { ok, parseJson, publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = publicApi(async ({ req, requestId }) => {
  const input = await parseJson(req, loginSchema);
  const meta = requestMeta(req.headers, requestId);
  const result = await login(input, meta);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), result.token, sessionCookieOptions(result.expiresAt));

  const ctx = await resolveSession(result.token, meta);
  return ok(ctx ? toSessionInfo(ctx) : { user: { id: result.userId }, org: { id: result.orgId } });
});
