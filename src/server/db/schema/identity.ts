import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  createdAt,
  deletedAt,
  membershipStatusEnum,
  primaryId,
  roleEnum,
  teamRoleEnum,
  timestamptz,
  updatedAt,
  userStatusEnum,
} from './_shared';

/** A tenant. Every tenant-scoped row carries `org_id`. */
export const organizations = pgTable(
  'organizations',
  {
    id: primaryId(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** IANA zone used to interpret calendar dates (due dates, "today"). */
    timezone: text('timezone').notNull().default('UTC'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('organizations_slug_unique').on(t.slug),
    check('organizations_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

/** Global identity. Org-specific role and status live on the membership. */
export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    title: text('title'),
    avatarUrl: text('avatar_url'),
    avatarColor: text('avatar_color').notNull().default('blue'),
    /** Null for accounts that will authenticate through SSO. */
    passwordHash: text('password_hash'),
    status: userStatusEnum('status').notNull().default('active'),
    lastLoginAt: timestamptz('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);

export const orgMemberships = pgTable(
  'org_memberships',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: roleEnum('role').notNull().default('researcher'),
    status: membershipStatusEnum('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('org_memberships_org_user_unique').on(t.orgId, t.userId),
    index('org_memberships_user_idx').on(t.userId),
  ],
);

export const teams = pgTable(
  'teams',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('blue'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: uuid('created_by').references(() => users.id),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('teams_org_name_unique')
      .on(t.orgId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const teamMemberships = pgTable(
  'team_memberships',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    role: teamRoleEnum('role').notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] }), index('team_memberships_user_idx').on(t.userId)],
);

/**
 * Server-side sessions. Only a SHA-256 hash of the token is stored, so a database
 * leak does not yield usable session cookies.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    tokenHash: text('token_hash').notNull(),
    createdAt: createdAt(),
    expiresAt: timestamptz('expires_at').notNull(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    revokedAt: timestamptz('revoked_at'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (t) => [uniqueIndex('sessions_token_hash_unique').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);
