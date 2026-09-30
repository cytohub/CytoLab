import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { env } from '../env';
import type { AuthContext } from './context';
import { resolveSession, sessionCookieName, type RequestMeta } from './sessions';

/**
 * The client's address as reported by the reverse proxy. Behind a proxy that
 * overwrites a known header, name it in CLIENT_IP_HEADER so a client cannot
 * pick its own address (rate limits and audit entries key on it). Otherwise the
 * first X-Forwarded-For hop is used, which is only as honest as the proxy.
 */
export function clientIp(h: Headers): string | null {
  const trusted = env().CLIENT_IP_HEADER;
  const raw = trusted ? h.get(trusted) : (h.get('x-forwarded-for') ?? h.get('x-real-ip'));
  // An address is at most 45 characters; the cap bounds what reaches logs and limiter keys.
  return raw?.split(',')[0]!.trim().slice(0, 64) || null;
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
