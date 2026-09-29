import 'server-only';
import { ForbiddenError } from '@/domain/errors';
import type { Permission } from '@/domain/permissions';
import type { AuthContext } from '../auth/context';

export function can(ctx: AuthContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

/** Throws 403 unless the actor's role grants the permission. */
export function authorize(ctx: AuthContext, permission: Permission): void {
  if (!can(ctx, permission)) throw new ForbiddenError();
}

/** Throws 403 unless a resource-aware policy passes. */
export function authorizePolicy(allowed: boolean, message?: string): void {
  if (!allowed) throw new ForbiddenError(message);
}
