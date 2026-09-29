import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import type { AuthContext } from './context';
import { resolveSession, sessionCookieName, type RequestMeta } from './sessions';

function clientIp(h: Headers): string | null {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim() || null;
  return h.get('x-real-ip');
}

export function requestMeta(h: Headers, requestId: string): RequestMeta {
  return { requestId, ip: clientIp(h), userAgent: h.get('user-agent')?.slice(0, 500) ?? null };
}

/** Auth for route handlers. */
export async function authFromRequest(req: NextRequest, requestId: string): Promise<AuthContext | null> {
  const token = req.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  return resolveSession(token, requestMeta(req.headers, requestId));
}

/** Auth for Server Components, memoized for the duration of one render. */
export const getServerAuth = cache(async (): Promise<AuthContext | null> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;
  return resolveSession(token, requestMeta(headerStore, crypto.randomUUID()));
});

export async function requireServerAuth(): Promise<AuthContext> {
  const ctx = await getServerAuth();
  if (!ctx) redirect('/login');
  return ctx;
}
