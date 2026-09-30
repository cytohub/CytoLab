import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../../auth/context';
import { db } from '../../db/client';
import { orgMemberships, teams } from '../../db/schema';

/**
 * Tenant checks for references a write stores. Users are global identities, so
 * "this user exists" is not enough: they must belong to the acting organization.
 */
export async function isOrgMember(ctx: AuthContext, userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, ctx.orgId), eq(orgMemberships.userId, userId)))
    .limit(1);
  return row !== undefined;
}

export async function isOrgTeam(ctx: AuthContext, teamId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt)))
    .limit(1);
  return row !== undefined;
}
