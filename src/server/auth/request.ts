import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { env } from '../env';
import { normalizeIp } from '../http/client-ip';
import { logger } from '../lib/logger';
import { sameSecret } from '../lib/secrets';
import type { AuthContext } from './context';
import { resolveSession, sessionCookieName, type RequestMeta } from './sessions';

export const CLIENT_IP_SECRET_HEADER = 'x-client-ip-secret';

let warnedUntrusted = false;
let warnedUnvouched = false;

/**
 * The client's address, which rate limits and audit entries key on.
 *
 * CLIENT_IP_HEADER names the header the reverse proxy overwrites (x-real-ip on
 * Railway, cf-connecting-ip behind Cloudflare). With CLIENT_IP_SECRET set, that
 * header is believed only when the CDN also sent the shared secret, so a
 * request sent straight to the origin cannot pick its own address.
 *
 * Without a trusted header, the last X-Forwarded-For hop is used: the nearest
 * proxy appends it, while earlier hops are whatever the client sent.
 */
export function clientIp(h: Headers): string | null {
  const { CLIENT_IP_HEADER, CLIENT_IP_SECRET, NODE_ENV } = env();
  if (CLIENT_IP_HEADER) {
    const vouched = !CLIENT_IP_SECRET || sameSecret(h.get(CLIENT_IP_SECRET_HEADER) ?? '', CLIENT_IP_SECRET);
    if (vouched) return normalizeIp(h.get(CLIENT_IP_HEADER)?.split(',')[0]);
    if (!warnedUnvouched) {
      // Expected now and then (someone reaching the origin directly), but if
      // every request lands here the CDN is not sending the secret, and all
      // visitors share the proxy's address in the rate limits.
      warnedUnvouched = true;
      logger.warn(`A request arrived without a valid ${CLIENT_IP_SECRET_HEADER}; its address comes from X-Forwarded-For`);
    }
  } else if (NODE_ENV === 'production' && !warnedUntrusted) {
    warnedUntrusted = true;
    logger.warn('CLIENT_IP_HEADER is not set; client addresses come from X-Forwarded-For and may be spoofed');
  }
  return normalizeIp(h.get('x-forwarded-for')?.split(',').at(-1) ?? h.get('x-real-ip'));
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
