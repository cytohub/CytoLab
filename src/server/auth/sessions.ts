import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { organizations, orgMemberships, sessions, teamMemberships, teams, users } from '../db/schema';
import {
  SESSION_TTL_MS,
  clearedSessionCookieOptions as clearedOptions,
  sessionCookieName as cookieName,
  sessionCookieOptions as cookieOptions,
} from '@/lib/session-cookie';
import { env } from '../env';
import { createAuthContext, type AuthContext } from './context';

export { SESSION_TTL_MS };
/** Avoid a write on every request: refresh last-seen at most this often. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function sessionCookieName(): string {
  return cookieName(env().NODE_ENV === 'production');
}

export function sessionCookieOptions(expiresAt: Date) {
  return cookieOptions(env().NODE_ENV === 'production', expiresAt);
}

export function clearedSessionCookieOptions() {
  return clearedOptions(env().NODE_ENV === 'production');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface RequestMeta {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

export async function createSession(userId: string, orgId: string, meta: RequestMeta) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db()
    .insert(sessions)
    .values({ userId, orgId, tokenHash: hashToken(token), expiresAt, ipAddress: meta.ip, userAgent: meta.userAgent });
  return { token, expiresAt };
}

/** Revokes a live session; returns who it belonged to, or null if it was already gone. */
export async function revokeSession(token: string): Promise<{ id: string; userId: string; orgId: string } | null> {
  const [row] = await db()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id, userId: sessions.userId, orgId: sessions.orgId });
  return row ?? null;
}

/** Resolves a raw session token into an AuthContext, or null if invalid/expired/revoked. */
export async function resolveSession(token: string, meta: RequestMeta): Promise<AuthContext | null> {
  if (!token || token.length > 200) return null;
  const now = new Date();

  const [row] = await db()
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      userName: users.name,
      email: users.email,
      title: users.title,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      userStatus: users.status,
      orgId: organizations.id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      timezone: organizations.timezone,
      isDemo: organizations.isDemo,
      role: orgMemberships.role,
      membershipStatus: orgMemberships.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, sessions.orgId))
    .innerJoin(orgMemberships, and(eq(orgMemberships.orgId, sessions.orgId), eq(orgMemberships.userId, sessions.userId)))
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!row || row.userStatus !== 'active' || row.membershipStatus !== 'active') return null;

  const teamRows = await db()
    .select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .innerJoin(teams, and(eq(teams.id, teamMemberships.teamId), isNull(teams.deletedAt)))
    .where(and(eq(teamMemberships.userId, row.userId), eq(teamMemberships.orgId, row.orgId)));

  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Sliding expiry: active sessions stay alive; idle ones lapse after the TTL.
    await db()
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(sessions.id, row.sessionId));
  }

  return createAuthContext({
    userId: row.userId,
    orgId: row.orgId,
    role: row.role,
    teamIds: teamRows.map((t) => t.teamId),
    sessionId: row.sessionId,
    requestId: meta.requestId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    user: {
      name: row.userName,
      email: row.email,
      title: row.title,
      avatarColor: row.avatarColor,
      avatarUrl: row.avatarUrl,
    },
    org: { name: row.orgName, slug: row.orgSlug, timezone: row.timezone, isDemo: row.isDemo },
  });
}
