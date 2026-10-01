import { NextResponse } from 'next/server';
import { logout } from '@/server/modules/auth/service';
import { requestMeta } from '@/server/auth/request';
import { clearedSessionCookieOptions, sessionCookieName } from '@/server/auth/sessions';
import { publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = publicApi(async ({ req, requestId }) => {
  const name = sessionCookieName();
  const token = req.cookies.get(name)?.value;
  if (token) await logout(token, requestMeta(req.headers, requestId));
  const res = NextResponse.json({ data: { success: true } });
  res.cookies.set(name, '', clearedSessionCookieOptions());
  return res;
});
