import { NextResponse, type NextRequest } from 'next/server';

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

export function proxy(request: NextRequest): NextResponse {
  // The other security headers (X-Frame-Options, nosniff, …) are set for every
  // route in next.config.ts. Only the nonce-based CSP needs per-request logic,
  // and only in production.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
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
