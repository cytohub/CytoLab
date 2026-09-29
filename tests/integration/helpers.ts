import { eq } from 'drizzle-orm';
import type { Role } from '../../src/domain/enums';
import { createAuthContext, type AuthContext } from '../../src/server/auth/context';
import { db } from '../../src/server/db/client';
import { experimentTypes, organizations, orgMemberships, teams, users } from '../../src/server/db/schema';
import { uuidv7 } from '../../src/server/db/uuid';

let counter = 0;

export interface TestWorkspace {
  orgId: string;
  timezone: string;
  typeId: string;
  teamId: string;
  ctxFor: (role: Role, opts?: { userId?: string; teamIds?: string[] }) => AuthContext;
  addUser: (role: Role, teamIds?: string[]) => Promise<AuthContext>;
}

/** Creates an isolated organization with one experiment type and a team. */
export async function createWorkspace(slugPrefix = 'test'): Promise<TestWorkspace> {
  const orgId = uuidv7();
  const slug = `${slugPrefix}-${(counter += 1)}-${Date.now().toString(36)}`;
  const timezone = 'UTC';
  await db().insert(organizations).values({ id: orgId, name: `Org ${slug}`, slug, timezone });

  const teamId = uuidv7();
  await db().insert(teams).values({ id: teamId, orgId, name: 'Team A' });

  const [type] = await db().insert(experimentTypes).values({ orgId, name: 'Assay', category: 'Test' }).returning({ id: experimentTypes.id });

  const ctxFor = (role: Role, opts: { userId?: string; teamIds?: string[] } = {}): AuthContext =>
    createAuthContext({
      userId: opts.userId ?? uuidv7(),
      orgId,
      role,
      teamIds: opts.teamIds ?? [],
      sessionId: null,
      requestId: `test-${counter}`,
      user: { name: 'Test User', email: 'test@example.com', title: null, avatarColor: 'blue', avatarUrl: null },
      org: { name: `Org ${slug}`, slug, timezone, isDemo: false },
    });

  const addUser = async (role: Role, teamIds: string[] = []): Promise<AuthContext> => {
    const userId = uuidv7();
    await db().insert(users).values({ id: userId, email: `${userId}@example.com`, name: `${role} user`, status: 'active' });
    await db().insert(orgMemberships).values({ orgId, userId, role, status: 'active' });
    return ctxFor(role, { userId, teamIds });
  };

  return { orgId, timezone, typeId: type!.id, teamId, ctxFor, addUser };
}

/** Reads a resource's audit trail for assertions. */
export async function auditEntriesFor(resourceId: string) {
  const { auditLog } = await import('../../src/server/db/schema');
  return db().select().from(auditLog).where(eq(auditLog.resourceId, resourceId));
}
