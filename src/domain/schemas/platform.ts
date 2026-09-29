import { z } from 'zod';
import { LINK_TYPES, ROLES, SEARCH_OBJECT_TYPES, TEAM_ROLES } from '../enums';
import { colorToken, csv, dateOnly, optionalText, queryBoolean, requiredText, uuid } from './common';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }).trim().toLowerCase(),
  password: z.string().min(1, { error: 'Password is required' }).max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

export const demoLoginSchema = z.object({ userId: uuid });

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export const createCommentSchema = z.object({
  body: requiredText(5_000, 'Comment'),
  parentId: uuid.nullish().transform((v) => v ?? null),
});
export type CreateCommentInput = z.output<typeof createCommentSchema>;
export const updateCommentSchema = z.object({ body: requiredText(5_000, 'Comment') });

export const setTagsSchema = z.object({ tagIds: z.array(uuid).max(20) });

export const createTagSchema = z.object({
  name: requiredText(40, 'Tag name'),
  color: colorToken.default('slate'),
});
export type CreateTagInput = z.output<typeof createTagSchema>;

export const createLinkSchema = z.object({
  targetId: uuid,
  linkType: z.enum(LINK_TYPES).default('related_to'),
});
export type CreateLinkInput = z.output<typeof createLinkSchema>;

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export const createMemberSchema = z.object({
  name: requiredText(120, 'Name'),
  email: z.email({ error: 'Enter a valid email address' }).trim().toLowerCase(),
  title: optionalText(120),
  role: z.enum(ROLES).default('researcher'),
  teamIds: z.array(uuid).max(20).default([]),
});
export type CreateMemberInput = z.output<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  name: requiredText(120, 'Name').optional(),
  title: optionalText(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['active', 'suspended'] as const).optional(),
});
export type UpdateMemberInput = z.output<typeof updateMemberSchema>;

export const updateProfileSchema = z.object({
  name: requiredText(120, 'Name').optional(),
  title: optionalText(120).optional(),
  avatarColor: colorToken.optional(),
});
export type UpdateProfileInput = z.output<typeof updateProfileSchema>;

export const createTeamSchema = z.object({
  name: requiredText(80, 'Team name'),
  description: optionalText(1_000),
  color: colorToken.default('blue'),
});
export type CreateTeamInput = z.output<typeof createTeamSchema>;
export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.output<typeof updateTeamSchema>;

export const addTeamMemberSchema = z.object({
  userId: uuid,
  role: z.enum(TEAM_ROLES).default('member'),
});
export type AddTeamMemberInput = z.output<typeof addTeamMemberSchema>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const createExperimentTypeSchema = z.object({
  name: requiredText(80, 'Name'),
  category: requiredText(80, 'Category'),
  description: optionalText(1_000),
  color: colorToken.default('blue'),
});
export const updateExperimentTypeSchema = createExperimentTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Feeds, search, insights
// ---------------------------------------------------------------------------

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, { error: 'Enter a search term' }).max(200),
  types: csv(z.enum(SEARCH_OBJECT_TYPES)),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});
export type SearchQuery = z.output<typeof searchQuerySchema>;

export const activityQuerySchema = z.object({
  entityId: uuid.optional(),
  projectId: uuid.optional(),
  actorId: uuid.optional(),
  /** Action namespace filter, e.g. "experiment" or "experiment.status_changed". */
  action: z.string().trim().max(80).regex(/^[a-z_.]+$/).optional(),
  before: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ActivityQuery = z.output<typeof activityQuerySchema>;

export const notificationsQuerySchema = z.object({
  unread: queryBoolean,
  before: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const markNotificationsSchema = z
  .object({
    ids: z.array(uuid).max(200).optional(),
    all: z.boolean().optional(),
  })
  .refine((v) => v.all === true || (v.ids?.length ?? 0) > 0, { error: 'Provide ids or all: true' });

export const ANALYTICS_RANGES = ['30d', '90d', '180d', '365d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const analyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES).default('180d'),
  granularity: z.enum(['week', 'month'] as const).default('week'),
  projectId: uuid.optional(),
  teamId: uuid.optional(),
});
export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;

export const timelineQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  projectId: csv(uuid),
  teamId: uuid.optional(),
  researcherId: uuid.optional(),
});
export type TimelineQuery = z.output<typeof timelineQuerySchema>;
