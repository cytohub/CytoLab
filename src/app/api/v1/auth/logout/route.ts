import { cookies } from 'next/headers';
import { logout } from '@/server/modules/auth/service';
import { sessionCookieName } from '@/server/auth/sessions';
import { ok, publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = publicApi(async () => {
  const cookieStore = await cookies();
  const name = sessionCookieName();
  const token = cookieStore.get(name)?.value;
  if (token) await logout(token);
  cookieStore.delete(name);
  return ok({ success: true });
});
