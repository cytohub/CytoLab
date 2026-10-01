import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_TTL_MS, sessionCookieName, sessionCookieOptions } from '@/lib/session-cookie';

/**
 * Per-request Content-Security-Policy.
 *
 * In production every document response carries a fresh nonce, and `script-src`
 * trusts only that nonce (plus `'strict-dynamic'`), so an injected inline
 * `<script>` cannot execute — the classic reflected/stored XSS vector is closed
 * without an `'unsafe-inline'` escape hatch. Next.js reads the nonce back from
 * this request header and stamps it onto every framework and bundle script it
 * emits; `'strict-dynamic'` then lets those trusted scripts pull in the rest of
 * the app's chunks while host allowlists are ignored. We also forward the nonce
 * as `x-nonce` so Server Components can opt their own inline tags in (the
 * theme-bootstrap script in the root layout is the only one that does).
 *
 * `style-src` intentionally keeps `'unsafe-inline'`: React renders inline
 * `style` attributes (progress bars, chart geometry) that are governed by
 * `style-src-attr` and cannot be authorized by a nonce. Style injection is far
 * lower risk than script injection, and the app renders no user-controlled
 * markup.
 *
 * Development sets no CSP at all: React Fast Refresh relies on `eval` and inline
 * bootstrapping, so a policy there would only produce noise without protecting a
 * production surface.
 */
function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * `www.` + the APP_URL host is served only so that people who type it arrive;
 * send them to the canonical origin so the app has one address and one cookie
 * jar. The target is always built from APP_URL (never from request headers),
 * and the path is assigned rather than resolved, so `//other.site` stays a path
 * on the canonical host instead of becoming an open redirect.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const appUrl = process.env.APP_URL;
  if (!appUrl || !URL.canParse(appUrl)) return null;
  const canonical = new URL(appUrl);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]!.trim();
  const host = (forwardedHost || request.headers.get('host'))?.toLowerCase();
  if (host !== `www.${canonical.host}`) return null;

  const target = new URL(canonical.origin);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 308);
}

const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
/** Page routes have no file extension; metadata files such as icon.svg do. */
const FILE_PATH_RE = /\.[a-z0-9]+$/i;

/**
 * Whether the request renders a page: a document load, or the fetch the router
 * makes for an in-app navigation or router.refresh(). Next strips its RSC
 * headers before the proxy runs, so navigations are recognized by the
 * browser's `Sec-Fetch-Dest: empty` instead; clients without Fetch Metadata
 * fall back to `Accept: text/html`.
 */
function isPageRequest(request: NextRequest): boolean {
  if (FILE_PATH_RE.test(request.nextUrl.pathname)) return false;
  const dest = request.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document' || dest === 'empty';
  return (request.headers.get('accept') ?? '').includes('text/html');
}

/**
 * Pushes the session cookie's expiry forward on page loads and navigations, so
 * someone who keeps working is not signed out 14 days after signing in. The
 * token is echoed back unchanged and unchecked: the sessions table decides
 * whether it is still valid. Static files never carry the cookie, so a shared
 * cache cannot store it with them.
 */
function refreshSessionCookie(request: NextRequest, response: NextResponse, production: boolean): void {
  if (!isPageRequest(request)) return;
  const name = sessionCookieName(production);
  const token = request.cookies.get(name)?.value;
  if (!token || !SESSION_TOKEN_RE.test(token)) return;
  response.cookies.set(name, token, sessionCookieOptions(production, new Date(Date.now() + SESSION_TTL_MS)));
}

export function proxy(request: NextRequest): NextResponse {
  // The other security headers (X-Frame-Options, nosniff, …) are set for every
  // route in next.config.ts. Only the nonce-based CSP needs per-request logic,
  // and only in production.
  if (process.env.NODE_ENV !== 'production') {
    const response = NextResponse.next();
    refreshSessionCookie(request, response, false);
    return response;
  }

  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  refreshSessionCookie(request, response, true);
  return response;
}

export const config = {
  matcher: [
    // Documents only. Skip API routes, static assets, the image optimizer and
    // the favicon (a CSP header there is meaningless), and skip `next/link`
    // prefetches, which fetch RSC payloads rather than render a document.
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
