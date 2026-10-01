import 'server-only';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { diffFields, hasChanges, removedFields } from '@/domain/diff';
import type { Role } from '@/domain/enums';
import { ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { ROLE_META, TEAM_ROLE_LABELS } from '@/domain/labels';
import type { CreateMemberInput, CreateTeamInput, UpdateMemberInput, UpdateProfileInput, UpdateTeamInput } from '@/domain/schemas/platform';
import { routes } from '@/lib/routes';
import type { AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db, type Executor } from '../../db/client';
import { isUniqueViolation } from '../../db/sql-utils';
import { orgMemberships, teamMemberships, teams, users } from '../../db/schema';
import { hashPassword } from '../../auth/password';
import { recordEvent } from '../../platform/events';
import { indexDocumentsMentioningTeam, indexDocumentsMentioningUser, indexUsers } from '../search/indexers';
import { initialsOf, type UserSummary } from '../shared/presenters';

export interface MemberView extends UserSummary {
  role: { value: Role; label: string };
  status: string;
  teams: Array<{ id: string; name: string; color: string; role: string }>;
  href: string;
}

export async function listMembers(ctx: AuthContext): Promise<MemberView[]> {
  const rows = await db()
    .select({
      id: users.id,
      name: users.name,
      title: users.title,
      email: users.email,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      role: orgMemberships.role,
      status: orgMemberships.status,
    })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(eq(orgMemberships.orgId, ctx.orgId))
    .orderBy(asc(users.name));

  const membershipRows = await db()
    .select({ userId: teamMemberships.userId, teamId: teams.id, name: teams.name, color: teams.color, role: teamMemberships.role })
    .from(teamMemberships)
    .innerJoin(teams, and(eq(teams.id, teamMemberships.teamId), isNull(teams.deletedAt)))
    .where(eq(teamMemberships.orgId, ctx.orgId));

  const teamsByUser = new Map<string, MemberView['teams']>();
  for (const row of membershipRows) {
    const list = teamsByUser.get(row.userId) ?? [];
    list.push({ id: row.teamId, name: row.name, color: row.color, role: TEAM_ROLE_LABELS[row.role] });
    teamsByUser.set(row.userId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title,
    email: row.email,
    avatarColor: row.avatarColor,
    avatarUrl: row.avatarUrl,
    initials: initialsOf(row.name),
    role: { value: row.role, label: ROLE_META[row.role].label },
    status: row.status,
    teams: teamsByUser.get(row.id) ?? [],
    href: routes.member(row.id),
  }));
}

async function belongsToAnotherOrg(executor: Executor, orgId: string, userId: string): Promise<boolean> {
  const [row] = await executor
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.userId, userId), ne(orgMemberships.orgId, orgId)))
    .limit(1);
  return row !== undefined;
}

export async function getMember(ctx: AuthContext, userId: string): Promise<MemberView> {
  const members = await listMembers(ctx);
  const member = members.find((m) => m.id === userId);
  if (!member) throw new NotFoundError('Member');
  return member;
}

export async function createMember(ctx: AuthContext, input: CreateMemberInput): Promise<MemberView> {
  authorize(ctx, 'member:manage');

  const userId = await db().transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    let id = existing?.id;

    if (!id) {
      const tempPassword = await hashPassword(crypto.randomUUID());
      const [row] = await tx.insert(users).values({ email: input.email, name: input.name, title: input.title, passwordHash: tempPassword, status: 'invited', avatarColor: pickColor(input.name) }).returning({ id: users.id });
      id = row!.id;
    } else {
      const [membership] = await tx.select({ id: orgMemberships.id }).from(orgMemberships).where(and(eq(orgMemberships.orgId, ctx.orgId), eq(orgMemberships.userId, id))).limit(1);
      if (membership) throw new ValidationError('That person is already a member', { email: ['Already a member of this organization'] });
      // Accounts are global. Attaching one that another organization uses would
      // reveal its profile here and add the person without their consent, so it
      // waits for an invitation the person accepts (not built yet).
      if (await belongsToAnotherOrg(tx, ctx.orgId, id)) {
        throw new ValidationError('That email is already used in another organization', { email: ['Invitations across organizations are not available yet'] });
      }
    }

    await tx.insert(orgMemberships).values({ orgId: ctx.orgId, userId: id, role: input.role, status: 'invited' });

    if (input.teamIds.length) {
      const valid = await tx.select({ id: teams.id }).from(teams).where(and(eq(teams.orgId, ctx.orgId), inArray(teams.id, input.teamIds), isNull(teams.deletedAt)));
      await tx.insert(teamMemberships).values(valid.map((t) => ({ teamId: t.id, userId: id!, orgId: ctx.orgId, role: 'member' as const }))).onConflictDoNothing();
    }

    await recordEvent(tx, ctx, { action: 'member.added', entityId: null, projectId: null, activity: false, audit: { action: 'create', resourceType: 'org_membership', resourceId: id, changes: null } });
    await indexUsers(tx, ctx.orgId, [id]);
    return id;
  });

  return getMember(ctx, userId);
}

export async function updateMember(ctx: AuthContext, userId: string, input: UpdateMemberInput): Promise<MemberView> {
  authorize(ctx, 'member:manage');
  const [membership] = await db()
    .select({ id: orgMemberships.id, role: orgMemberships.role, status: orgMemberships.status, name: users.name, title: users.title })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(and(eq(orgMemberships.orgId, ctx.orgId), eq(orgMemberships.userId, userId)))
    .limit(1);
  if (!membership) throw new NotFoundError('Member');
  const changes = diffFields(
    { name: membership.name, title: membership.title, role: membership.role, status: membership.status },
    { name: input.name, title: input.title, role: input.role, status: input.status },
  );
  // Name and title live on the global account; an admin may only change them
  // for people no other organization shares.
  if ((changes.name || changes.title) && (await belongsToAnotherOrg(db(), ctx.orgId, userId))) {
    throw new ForbiddenError('This person also belongs to another organization, so only they can change their name and title');
  }

  await db().transaction(async (tx) => {
    if (input.name !== undefined || input.title !== undefined) {
      await tx.update(users).set({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.title !== undefined ? { title: input.title } : {}), updatedAt: new Date() }).where(eq(users.id, userId));
    }
    if (input.role !== undefined || input.status !== undefined) {
      await tx.update(orgMemberships).set({ ...(input.role ? { role: input.role } : {}), ...(input.status ? { status: input.status } : {}), updatedAt: new Date() }).where(eq(orgMemberships.id, membership.id));
    }
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'member.updated', entityId: null, projectId: null, activity: false, audit: { action: 'update', resourceType: 'org_membership', resourceId: userId, changes } });
    }
    await indexUsers(tx, ctx.orgId, [userId]);
    if (changes.name || changes.title) await indexDocumentsMentioningUser(tx, userId);
  });

  return getMember(ctx, userId);
}

export async function updateProfile(ctx: AuthContext, input: UpdateProfileInput): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.title !== undefined) set.title = input.title;
  if (input.avatarColor !== undefined) set.avatarColor = input.avatarColor;
  const [before] = await db().select({ name: users.name, title: users.title, avatarColor: users.avatarColor }).from(users).where(eq(users.id, ctx.userId)).limit(1);
  const changes = before ? diffFields(before, { name: input.name, title: input.title, avatarColor: input.avatarColor }) : {};
  await db().transaction(async (tx) => {
    await tx.update(users).set(set).where(eq(users.id, ctx.userId));
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'profile.updated', entityId: null, projectId: null, activity: false, audit: { action: 'update', resourceType: 'user', resourceId: ctx.userId, changes } });
    }
    if (changes.name || changes.title) await indexDocumentsMentioningUser(tx, ctx.userId);
  });
}

// --- Teams -----------------------------------------------------------------

export interface TeamView {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
  members: Array<UserSummary & { role: string }>;
  href: string;
}

export async function listTeams(ctx: AuthContext): Promise<TeamView[]> {
  const teamRows = await db()
    .select({ id: teams.id, name: teams.name, description: teams.description, color: teams.color, memberCount: sql<number>`count(${teamMemberships.userId})::int` })
    .from(teams)
    .leftJoin(teamMemberships, eq(teamMemberships.teamId, teams.id))
    .where(and(eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt)))
    .groupBy(teams.id)
    .orderBy(asc(teams.name));

  const memberRows = await db()
    .select({ teamId: teamMemberships.teamId, role: teamMemberships.role, id: users.id, name: users.name, title: users.title, email: users.email, color: users.avatarColor, avatar: users.avatarUrl })
    .from(teamMemberships)
    .innerJoin(users, eq(users.id, teamMemberships.userId))
    .where(eq(teamMemberships.orgId, ctx.orgId))
    .orderBy(asc(users.name));

  const membersByTeam = new Map<string, TeamView['members']>();
  for (const row of memberRows) {
    const list = membersByTeam.get(row.teamId) ?? [];
    list.push({ id: row.id, name: row.name, title: row.title, email: row.email, avatarColor: row.color, avatarUrl: row.avatar, initials: initialsOf(row.name), role: TEAM_ROLE_LABELS[row.role] });
    membersByTeam.set(row.teamId, list);
  }

  return teamRows.map((row) => ({ id: row.id, name: row.name, description: row.description, color: row.color, memberCount: row.memberCount, members: membersByTeam.get(row.id) ?? [], href: routes.team(row.id) }));
}

export async function getTeam(ctx: AuthContext, teamId: string): Promise<TeamView> {
  const team = (await listTeams(ctx)).find((t) => t.id === teamId);
  if (!team) throw new NotFoundError('Team');
  return team;
}

export async function createTeam(ctx: AuthContext, input: CreateTeamInput): Promise<TeamView> {
  authorize(ctx, 'team:manage');
  const teamId = await db().transaction(async (tx) => {
    const [row] = await tx.insert(teams).values({ orgId: ctx.orgId, name: input.name, description: input.description, color: input.color, createdBy: ctx.userId }).returning({ id: teams.id });
    await recordEvent(tx, ctx, { action: 'team.created', entityId: null, projectId: null, activity: false, audit: { action: 'create', resourceType: 'team', resourceId: row!.id, changes: null } });
    return row!.id;
  }).catch((err) => {
    if (isUniqueViolation(err)) throw new ValidationError('A team with that name already exists', { name: ['Choose a different name'] });
    throw err;
  });
  return getTeam(ctx, teamId);
}

export async function updateTeam(ctx: AuthContext, teamId: string, input: UpdateTeamInput): Promise<TeamView> {
  authorize(ctx, 'team:manage');
  const [team] = await db().select({ name: teams.name, description: teams.description, color: teams.color }).from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt))).limit(1);
  if (!team) throw new NotFoundError('Team');
  const changes = diffFields(team, input);
  await db().transaction(async (tx) => {
    await tx.update(teams).set({ ...input, updatedAt: new Date() }).where(eq(teams.id, teamId));
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'team.updated', entityId: null, projectId: null, activity: false, audit: { action: 'update', resourceType: 'team', resourceId: teamId, changes } });
    }
    if (changes.name) await indexDocumentsMentioningTeam(tx, ctx.orgId, teamId);
  });
  return getTeam(ctx, teamId);
}

export async function addTeamMember(ctx: AuthContext, teamId: string, input: { userId: string; role: 'lead' | 'member' }): Promise<TeamView> {
  authorize(ctx, 'team:manage');
  const [team] = await db().select({ id: teams.id }).from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt))).limit(1);
  if (!team) throw new NotFoundError('Team');
  const [membership] = await db().select({ id: orgMemberships.id }).from(orgMemberships).where(and(eq(orgMemberships.orgId, ctx.orgId), eq(orgMemberships.userId, input.userId))).limit(1);
  if (!membership) throw new ValidationError('That person is not a member of this organization', { userId: ['Unknown member'] });
  await db().transaction(async (tx) => {
    const [existing] = await tx.select({ role: teamMemberships.role }).from(teamMemberships).where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, input.userId))).limit(1);
    await tx.insert(teamMemberships).values({ teamId, userId: input.userId, orgId: ctx.orgId, role: input.role }).onConflictDoUpdate({ target: [teamMemberships.teamId, teamMemberships.userId], set: { role: input.role } });
    const changes = diffFields({ userId: existing ? input.userId : null, role: existing?.role ?? null }, { userId: input.userId, role: input.role });
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'team.member_added', entityId: null, projectId: null, activity: false, audit: { action: existing ? 'update' : 'link', resourceType: 'team_membership', resourceId: teamId, changes } });
    }
    await indexUsers(tx, ctx.orgId, [input.userId]);
  });
  return getTeam(ctx, teamId);
}

export async function removeTeamMember(ctx: AuthContext, teamId: string, userId: string): Promise<void> {
  authorize(ctx, 'team:manage');
  await db().transaction(async (tx) => {
    const [removed] = await tx
      .delete(teamMemberships)
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId), eq(teamMemberships.orgId, ctx.orgId)))
      .returning({ userId: teamMemberships.userId, role: teamMemberships.role });
    if (removed) {
      await recordEvent(tx, ctx, { action: 'team.member_removed', entityId: null, projectId: null, activity: false, audit: { action: 'unlink', resourceType: 'team_membership', resourceId: teamId, changes: removedFields(removed) } });
    }
    await indexUsers(tx, ctx.orgId, [userId]);
  });
}

/** Directory options for pickers (assignees, owners, filters). */
export async function memberOptions(ctx: AuthContext): Promise<Array<{ id: string; name: string; title: string | null; avatarColor: string; initials: string }>> {
  const rows = await db()
    .select({ id: users.id, name: users.name, title: users.title, color: users.avatarColor })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(and(eq(orgMemberships.orgId, ctx.orgId), eq(orgMemberships.status, 'active')))
    .orderBy(asc(users.name));
  return rows.map((r) => ({ id: r.id, name: r.name, title: r.title, avatarColor: r.color, initials: initialsOf(r.name) }));
}

export async function teamOptions(ctx: AuthContext): Promise<Array<{ id: string; name: string; color: string }>> {
  const rows = await db().select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(and(eq(teams.orgId, ctx.orgId), isNull(teams.deletedAt))).orderBy(asc(teams.name));
  return rows;
}

const COLORS = ['blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'teal', 'slate'] as const;
function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

