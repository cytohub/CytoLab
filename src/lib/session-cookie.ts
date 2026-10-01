/**
 * Session cookie settings, shared by the sign-in handler that sets the cookie
 * and the proxy that pushes its expiry forward while someone is active. The
 * cookie only carries the token: the sessions table decides whether a session
 * is still valid, and its expiry slides on its own.
 */

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** `__Host-` binds the cookie to this exact origin over HTTPS (no Domain, Path=/). */
export function sessionCookieName(production: boolean): string {
  return production ? '__Host-cytolab_session' : 'cytolab_session';
}

export function sessionCookieOptions(production: boolean, expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: production,
    path: '/',
    expires: expiresAt,
  };
}
