import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { UnauthorizedError } from '@/domain/errors';
import type { LoginInput } from '@/domain/schemas/platform';
import { db } from '../../db/client';
import { organizations, orgMemberships, users } from '../../db/schema';
import { timingSafeDummyHash, verifyPassword } from '../../auth/password';
import { createSession, revokeSession, type RequestMeta } from '../../auth/sessions';
import { recordSystemAudit } from '../../platform/events';
import { ipBucket } from '../../http/client-ip';
import { loginAccountLimiter, loginAddressLimiter, loginLimiter } from '../../http/rate-limit';
import { demoWorkspacesOpen, env } from '../../env';
import { toUserSummary, type UserSummary } from '../shared/presenters';

export interface LoginResult {
  token: string;
  expiresAt: Date;
  userId: string;
  orgId: string;
}

/**
 * Verifies credentials and opens a session. Runs in constant-ish time whether or
 * not the account exists (dummy hash) and is rate-limited per IP + email.
 */
export async function login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
  const address = ipBucket(meta.ip);
  const pairKey = `${address}:${input.email}`;
  loginAddressLimiter.consume(address);
  loginLimiter.consume(pairKey);

  const [account] = await db()
    .select({
      userId: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
      orgId: orgMemberships.orgId,
      membershipStatus: orgMemberships.status,
      orgIsDemo: organizations.isDemo,
    })
    .from(users)
    .innerJoin(orgMemberships, eq(orgMemberships.userId, users.id))
    .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
    // The oldest *active* membership: a suspended or pending one elsewhere
    // must not lock the person out of the organization they work in.
    .where(and(eq(users.email, input.email), eq(orgMemberships.status, 'active')))
    .orderBy(asc(orgMemberships.createdAt))
    .limit(1);

  // The per-account cap stops guessing spread over many addresses. Open demo
  // accounts have a published password, so there is nothing to guess, and the
  // cap would only let anyone lock everyone else out of them.
  const publishedPassword = account?.orgIsDemo === true && demoWorkspacesOpen();
  if (!publishedPassword) loginAccountLimiter.consume(input.email);

  const hash = account?.passwordHash ?? (await timingSafeDummyHash());
  const passwordOk = await verifyPassword(input.password, hash);

  const demoClosed = account?.orgIsDemo === true && !demoWorkspacesOpen();
  if (!account || !passwordOk || account.status !== 'active' || account.membershipStatus !== 'active' || demoClosed) {
    await db().transaction((tx) =>
      recordSystemAudit(tx, {
        orgId: account?.orgId ?? null,
        actorId: account?.userId ?? null,
        action: 'login',
        resourceType: 'session',
        resourceId: null,
        metadata: { outcome: 'failed', email: input.email, ip: meta.ip, ...(demoClosed ? { reason: 'demo_workspace_closed' } : {}) },
      }),
    );
    throw new UnauthorizedError('Incorrect email or password');
  }

  const session = await createSession(account.userId, account.orgId, meta);
  await db()
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, account.userId));
  await db().transaction((tx) =>
    recordSystemAudit(tx, {
      orgId: account.orgId,
      actorId: account.userId,
      action: 'login',
      resourceType: 'session',
      resourceId: null,
      metadata: { outcome: 'success', ip: meta.ip, userAgent: meta.userAgent },
    }),
  );
  loginLimiter.reset(pairKey);
  loginAccountLimiter.reset(input.email);

  return { token: session.token, expiresAt: session.expiresAt, userId: account.userId, orgId: account.orgId };
}

export async function logout(token: string, meta: RequestMeta): Promise<void> {
  await db().transaction(async (tx) => {
    const session = await revokeSession(token, tx);
    if (!session) return;
    await recordSystemAudit(tx, {
      orgId: session.orgId,
      actorId: session.userId,
      action: 'logout',
      resourceType: 'session',
      resourceId: session.id,
      metadata: { ip: meta.ip, userAgent: meta.userAgent },
    });
  });
}

export interface DemoAccount {
  user: UserSummary;
  role: string;
}

/** Demo sign-in options shown on the login page when DEMO_MODE is on. */
export async function listDemoAccounts(): Promise<{ enabled: boolean; password: string | null; accounts: DemoAccount[] }> {
  if (!env().DEMO_MODE || !demoWorkspacesOpen()) return { enabled: false, password: null, accounts: [] };

  const rows = await db()
    .select({
      id: users.id,
      name: users.name,
      title: users.title,
      email: users.email,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      role: orgMemberships.role,
    })
    .from(users)
    .innerJoin(orgMemberships, eq(orgMemberships.userId, users.id))
    .innerJoin(organizations, and(eq(organizations.id, orgMemberships.orgId), eq(organizations.isDemo, true)))
    .where(and(eq(users.status, 'active'), isNull(users.avatarUrl)))
    .orderBy(asc(orgMemberships.createdAt));

  // One representative account per role keeps the picker short.
  const seen = new Set<string>();
  const accounts: DemoAccount[] = [];
  for (const row of rows) {
    if (seen.has(row.role)) continue;
    seen.add(row.role);
    accounts.push({ user: toUserSummary(row)!, role: row.role });
  }
  return { enabled: true, password: 'cytolab-demo', accounts };
}
