import 'server-only';
import type { ActorType, Role } from '@/domain/enums';
import { permissionsForRole, type Actor, type Permission } from '@/domain/permissions';

/**
 * Everything a service needs to know about who is acting. Resolved once per
 * request (session cookie today; API tokens, SSO, service accounts and AI agents
 * later) and passed explicitly to every service call.
 */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  teamIds: readonly string[];
  actorType: ActorType;
  sessionId: string | null;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  user: { name: string; email: string; title: string | null; avatarColor: string; avatarUrl: string | null };
  org: { name: string; slug: string; timezone: string; isDemo: boolean };
}

export interface AuthContextInput {
  userId: string;
  orgId: string;
  role: Role;
  teamIds: readonly string[];
  sessionId: string | null;
  requestId: string;
  ip?: string | null;
  userAgent?: string | null;
  actorType?: ActorType;
  user: AuthContext['user'];
  org: AuthContext['org'];
}

export function createAuthContext(input: AuthContextInput): AuthContext {
  return {
    ...input,
    actorType: input.actorType ?? 'user',
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    permissions: new Set(permissionsForRole(input.role)),
  };
}

export function actorOf(ctx: AuthContext): Actor {
  return { userId: ctx.userId, role: ctx.role, teamIds: ctx.teamIds };
}

/** The subset of the context that is safe to send to the browser. */
export interface SessionInfo {
  user: AuthContext['user'] & { id: string };
  org: AuthContext['org'] & { id: string };
  role: Role;
  permissions: Permission[];
  teamIds: string[];
}

export function toSessionInfo(ctx: AuthContext): SessionInfo {
  return {
    user: { id: ctx.userId, ...ctx.user },
    org: { id: ctx.orgId, ...ctx.org },
    role: ctx.role,
    permissions: [...ctx.permissions],
    teamIds: [...ctx.teamIds],
  };
}
