import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { orgMemberships, teams } from '../../db/schema';

/**
 * Tenant checks for references a write stores. Users are global identities, so
 * "this user exists" is not enough: they must be an active member of the acting
 * organization (not suspended, not a pending invite).
 *
 * Callers check only references that change, so a record whose owner was later
 * suspended can still be edited without reassigning it first.
 */
export async function isOrgMember(ctx: AuthContext, userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, ctx.orgId), eq(orgMemberships.userId, userId), eq(orgMemberships.status, 'active')))
    .limit(1);
  return row !== undefined;
}

/** The new value when it differs from the stored one, otherwise undefined (nothing to check). */
export function changed<T>(next: T | undefined, current: T): T | undefined {
  return next !== undefined && next !== current ? next : undefined;
}

export async function isOrgTeam(ctx: AuthContext, teamId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt)))
    .limit(1);
  return row !== undefined;
}
