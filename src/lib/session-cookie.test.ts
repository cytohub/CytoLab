import { describe, expect, it } from 'vitest';
import { clearedSessionCookieOptions, sessionCookieName } from './session-cookie';

describe('clearing the session cookie', () => {
  it('repeats Secure and Path in production, or browsers ignore the removal of a __Host- cookie', () => {
    expect(sessionCookieName(true)).toBe('__Host-cytolab_session');
    const cleared = clearedSessionCookieOptions(true);
    expect(cleared).toMatchObject({ secure: true, path: '/', httpOnly: true, sameSite: 'lax', maxAge: 0 });
    expect(cleared.expires.getTime()).toBe(0);
  });
});
