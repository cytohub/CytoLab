import 'server-only';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { diffFields, hasChanges, removedFields } from '@/domain/diff';
import { LINK_TYPE_LABELS } from '@/domain/labels';
import type { LinkType } from '@/domain/enums';
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { canModifyAuthoredContent } from '@/domain/permissions';
import type { CreateCommentInput, CreateLinkInput, CreateTagInput } from '@/domain/schemas/platform';
import { actorOf, type AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db } from '../../db/client';
import { comments, entityLinks, entityTags, tags } from '../../db/schema';
import { getEntityRef, getEntityRefs, type EntityRef } from '../../platform/entities';
import { recordEvent } from '../../platform/events';
import { initialsOf, type TagSummary, type UserSummary } from '../shared/presenters';
import { users } from '../../db/schema';

// --- Comments --------------------------------------------------------------

export interface CommentView {
  id: string;
  body: string;
  author: UserSummary | null;
  parentId: string | null;
  createdAt: string;
  editedAt: string | null;
  canModify: boolean;
}

export async function listComments(ctx: AuthContext, entityId: string): Promise<CommentView[]> {
  await getEntityRef(ctx, entityId, { includeDeleted: true });
  const rows = await db()
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      authorId: users.id,
      authorName: users.name,
      authorTitle: users.title,
      authorEmail: users.email,
      authorColor: users.avatarColor,
      authorAvatar: users.avatarUrl,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.orgId, ctx.orgId), eq(comments.entityId, entityId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    author: row.authorId ? { id: row.authorId, name: row.authorName!, title: row.authorTitle, email: row.authorEmail!, avatarColor: row.authorColor!, avatarUrl: row.authorAvatar, initials: initialsOf(row.authorName!) } : null,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    canModify: canModifyAuthoredContent(actorOf(ctx), row.authorId, 'comment:moderate'),
  }));
}

export async function createComment(ctx: AuthContext, entityId: string, input: CreateCommentInput): Promise<{ id: string }> {
  authorize(ctx, 'comment:create');
  const entity = await getEntityRef(ctx, entityId);

  if (input.parentId) {
    const [parent] = await db().select({ id: comments.id }).from(comments).where(and(eq(comments.id, input.parentId), eq(comments.entityId, entityId), isNull(comments.deletedAt))).limit(1);
    if (!parent) throw new ValidationError('Reply target is invalid', { parentId: ['Unknown comment'] });
  }

  return db().transaction(async (tx) => {
    const [row] = await tx.insert(comments).values({ orgId: ctx.orgId, entityId, parentId: input.parentId, authorId: ctx.userId, body: input.body }).returning({ id: comments.id });
    await recordEvent(tx, ctx, {
      action: 'comment.created',
      entityId,
      projectId: null,
      payload: { entityTitle: entity.title, entityType: entity.type },
      audit: { action: 'create', resourceType: 'comment', resourceId: row!.id, changes: null },
    });
    return row!;
  });
}

export async function updateComment(ctx: AuthContext, commentId: string, body: string): Promise<{ id: string }> {
  const [current] = await db().select({ id: comments.id, authorId: comments.authorId, entityId: comments.entityId, body: comments.body }).from(comments).where(and(eq(comments.id, commentId), eq(comments.orgId, ctx.orgId), isNull(comments.deletedAt))).limit(1);
  if (!current) throw new NotFoundError('Comment');
  if (current.authorId !== ctx.userId) throw new ForbiddenError('You can only edit your own comments');
  const changes = diffFields({ body: current.body }, { body });
  await db().transaction(async (tx) => {
    await tx.update(comments).set({ body, editedAt: new Date(), updatedAt: new Date() }).where(eq(comments.id, commentId));
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'comment.edited', entityId: current.entityId, projectId: null, activity: false, audit: { action: 'update', resourceType: 'comment', resourceId: commentId, changes } });
    }
  });
  return { id: commentId };
}

export async function deleteComment(ctx: AuthContext, commentId: string): Promise<void> {
  const [current] = await db().select({ id: comments.id, authorId: comments.authorId, entityId: comments.entityId }).from(comments).where(and(eq(comments.id, commentId), eq(comments.orgId, ctx.orgId), isNull(comments.deletedAt))).limit(1);
  if (!current) throw new NotFoundError('Comment');
  if (!canModifyAuthoredContent(actorOf(ctx), current.authorId, 'comment:moderate')) throw new ForbiddenError('You can only delete your own comments');
  await db().transaction(async (tx) => {
    await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
    await recordEvent(tx, ctx, { action: 'comment.deleted', entityId: current.entityId, projectId: null, activity: false, audit: { action: 'delete', resourceType: 'comment', resourceId: commentId, changes: null } });
  });
}

// --- Tags ------------------------------------------------------------------

export async function listTags(ctx: AuthContext): Promise<TagSummary[]> {
  const rows = await db().select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.orgId, ctx.orgId)).orderBy(asc(tags.name));
  return rows;
}

export async function createTag(ctx: AuthContext, input: CreateTagInput): Promise<TagSummary> {
  authorize(ctx, 'tag:create');
  return db()
    .transaction(async (tx) => {
      const [row] = await tx.insert(tags).values({ orgId: ctx.orgId, name: input.name, color: input.color, createdBy: ctx.userId }).returning({ id: tags.id, name: tags.name, color: tags.color });
      await recordEvent(tx, ctx, { action: 'tag.created', entityId: null, projectId: null, activity: false, audit: { action: 'create', resourceType: 'tag', resourceId: row!.id, changes: null } });
      return row!;
    })
    .catch((err) => {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') throw new ValidationError('That tag already exists', { name: ['A tag with this name already exists'] });
      throw err;
    });
}

/** Replaces the full set of tags on an entity. */
export async function setEntityTags(ctx: AuthContext, entityId: string, tagIds: string[]): Promise<TagSummary[]> {
  authorize(ctx, 'tag:apply');
  await getEntityRef(ctx, entityId);
  const unique = [...new Set(tagIds)];
  if (unique.length > 0) {
    const valid = await db().select({ id: tags.id }).from(tags).where(and(eq(tags.orgId, ctx.orgId)));
    const validIds = new Set(valid.map((t) => t.id));
    for (const id of unique) if (!validIds.has(id)) throw new ValidationError('Tag is invalid', { tagIds: ['Unknown tag'] });
  }

  await db().transaction(async (tx) => {
    const previous = await tx
      .delete(entityTags)
      .where(and(eq(entityTags.entityId, entityId), eq(entityTags.orgId, ctx.orgId)))
      .returning({ tagId: entityTags.tagId });
    if (unique.length > 0) {
      await tx.insert(entityTags).values(unique.map((tagId) => ({ entityId, tagId, orgId: ctx.orgId, createdBy: ctx.userId }))).onConflictDoNothing();
    }
    const changes = diffFields({ tags: previous.map((t) => t.tagId).sort() }, { tags: [...unique].sort() });
    if (hasChanges(changes)) {
      await recordEvent(tx, ctx, { action: 'tags.updated', entityId, projectId: null, activity: false, audit: { action: 'update', resourceType: 'entity_tags', resourceId: entityId, changes } });
    }
  });

  const rows = await db().select({ id: tags.id, name: tags.name, color: tags.color }).from(entityTags).innerJoin(tags, eq(tags.id, entityTags.tagId)).where(eq(entityTags.entityId, entityId)).orderBy(asc(tags.name));
  return rows;
}

// --- Links -----------------------------------------------------------------

export interface LinkView {
  id: string;
  linkType: LinkType;
  direction: 'outgoing' | 'incoming';
  label: string;
  entity: EntityRef;
  createdAt: string;
}

export async function listLinks(ctx: AuthContext, entityId: string): Promise<LinkView[]> {
  await getEntityRef(ctx, entityId, { includeDeleted: true });
  const rows = await db()
    .select({ id: entityLinks.id, sourceId: entityLinks.sourceId, targetId: entityLinks.targetId, linkType: entityLinks.linkType, createdAt: entityLinks.createdAt })
    .from(entityLinks)
    .where(and(eq(entityLinks.orgId, ctx.orgId), or(eq(entityLinks.sourceId, entityId), eq(entityLinks.targetId, entityId))));

  const otherIds = rows.map((r) => (r.sourceId === entityId ? r.targetId : r.sourceId));
  const refs = await getEntityRefs(ctx, otherIds);

  return rows
    .map((row) => {
      const outgoing = row.sourceId === entityId;
      const otherId = outgoing ? row.targetId : row.sourceId;
      const entity = refs.get(otherId);
      if (!entity) return null;
      return {
        id: row.id,
        linkType: row.linkType,
        direction: outgoing ? ('outgoing' as const) : ('incoming' as const),
        label: outgoing ? LINK_TYPE_LABELS[row.linkType].forward : LINK_TYPE_LABELS[row.linkType].reverse,
        entity,
        createdAt: row.createdAt.toISOString(),
      };
    })
    .filter((v): v is LinkView => v !== null);
}

export async function createLink(ctx: AuthContext, sourceId: string, input: CreateLinkInput): Promise<{ id: string }> {
  authorize(ctx, 'link:manage');
  if (sourceId === input.targetId) throw new BadRequestError('An object cannot be linked to itself');
  const [source, target] = await Promise.all([getEntityRef(ctx, sourceId), getEntityRef(ctx, input.targetId)]);

  return db().transaction(async (tx) => {
    try {
      const [row] = await tx.insert(entityLinks).values({ orgId: ctx.orgId, sourceId, targetId: input.targetId, linkType: input.linkType, createdBy: ctx.userId }).returning({ id: entityLinks.id });
      await recordEvent(tx, ctx, {
        action: 'link.created',
        entityId: sourceId,
        projectId: null,
        payload: { targetDisplayId: target.displayId, linkType: input.linkType, sourceDisplayId: source.displayId },
        audit: { action: 'link', resourceType: 'entity_link', resourceId: row!.id, changes: null },
      });
      return row!;
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') throw new ValidationError('These objects are already linked', { targetId: ['Link already exists'] });
      throw err;
    }
  });
}

export async function deleteLink(ctx: AuthContext, linkId: string): Promise<void> {
  authorize(ctx, 'link:manage');
  await db().transaction(async (tx) => {
    const [removed] = await tx
      .delete(entityLinks)
      .where(and(eq(entityLinks.id, linkId), eq(entityLinks.orgId, ctx.orgId)))
      .returning({ sourceId: entityLinks.sourceId, targetId: entityLinks.targetId, linkType: entityLinks.linkType });
    if (!removed) throw new NotFoundError('Link');
    await recordEvent(tx, ctx, { action: 'link.deleted', entityId: removed.sourceId, projectId: null, activity: false, audit: { action: 'unlink', resourceType: 'entity_link', resourceId: linkId, changes: removedFields(removed) } });
  });
}
