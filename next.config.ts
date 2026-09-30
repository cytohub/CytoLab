import type { NextConfig } from 'next';

/**
 * Baseline security headers applied to every route. The Content-Security-Policy
 * is intentionally not here: it needs a fresh per-request nonce, so it is set in
 * `src/proxy.ts` (production only) where each document response can carry its own
 * `script-src 'nonce-…' 'strict-dynamic'`.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
