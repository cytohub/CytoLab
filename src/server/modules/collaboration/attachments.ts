import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { ForbiddenError, NotFoundError, PayloadTooLargeError, ValidationError } from '@/domain/errors';
import { canDeleteAttachment } from '@/domain/permissions';
import { actorOf, type AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db } from '../../db/client';
import { attachments, users } from '../../db/schema';
import { env } from '../../env';
import { getEntityRef } from '../../platform/entities';
import { recordEvent } from '../../platform/events';
import { newStorageKey, sha256, storage } from '../../platform/storage';
import { initialsOf, type UserSummary } from '../shared/presenters';

export interface AttachmentView {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  description: string | null;
  uploadedBy: UserSummary | null;
  createdAt: string;
  downloadHref: string;
  canDelete: boolean;
}

/** Content types accepted for upload (defense-in-depth alongside the size cap). */
const ALLOWED_PREFIXES = ['image/', 'text/'];
const ALLOWED_EXACT = new Set([
  'application/pdf',
  'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/octet-stream',
  'text/csv',
]);

function isAllowedType(contentType: string): boolean {
  return ALLOWED_EXACT.has(contentType) || ALLOWED_PREFIXES.some((p) => contentType.startsWith(p));
}

export async function listAttachments(ctx: AuthContext, entityId: string): Promise<AttachmentView[]> {
  await getEntityRef(ctx, entityId, { includeDeleted: true });
  const rows = await db()
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      contentType: attachments.contentType,
      sizeBytes: attachments.sizeBytes,
      description: attachments.description,
      createdAt: attachments.createdAt,
      uploaderId: users.id,
      uploaderName: users.name,
      uploaderTitle: users.title,
      uploaderEmail: users.email,
      uploaderColor: users.avatarColor,
      uploaderAvatar: users.avatarUrl,
    })
    .from(attachments)
    .leftJoin(users, eq(users.id, attachments.uploadedBy))
    .where(and(eq(attachments.orgId, ctx.orgId), eq(attachments.entityId, entityId), isNull(attachments.deletedAt)))
    .orderBy(desc(attachments.createdAt));

  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    description: row.description,
    uploadedBy: row.uploaderId ? { id: row.uploaderId, name: row.uploaderName!, title: row.uploaderTitle, email: row.uploaderEmail!, avatarColor: row.uploaderColor!, avatarUrl: row.uploaderAvatar, initials: initialsOf(row.uploaderName!) } : null,
    createdAt: row.createdAt.toISOString(),
    downloadHref: `/api/v1/attachments/${row.id}/download`,
    canDelete: canDeleteAttachment(actorOf(ctx), row.uploaderId),
  }));
}

export async function createAttachment(
  ctx: AuthContext,
  entityId: string,
  file: { fileName: string; contentType: string; data: Uint8Array; description?: string | null },
): Promise<{ id: string }> {
  authorize(ctx, 'attachment:upload');
  await getEntityRef(ctx, entityId);

  if (file.data.byteLength === 0) throw new ValidationError('The file is empty', { file: ['Choose a non-empty file'] });
  if (file.data.byteLength > env().MAX_UPLOAD_BYTES) throw new PayloadTooLargeError(env().MAX_UPLOAD_BYTES);
  if (!isAllowedType(file.contentType)) throw new ValidationError('That file type is not allowed', { file: [`Unsupported type: ${file.contentType}`] });

  const storageKey = newStorageKey(ctx.orgId);
  await storage().put(storageKey, file.data, file.contentType);

  try {
    return await db().transaction(async (tx) => {
      const [row] = await tx
        .insert(attachments)
        .values({
          orgId: ctx.orgId,
          entityId,
          fileName: file.fileName.slice(0, 255),
          contentType: file.contentType,
          sizeBytes: file.data.byteLength,
          storageKey,
          checksumSha256: sha256(file.data),
          description: file.description ?? null,
          uploadedBy: ctx.userId,
        })
        .returning({ id: attachments.id });
      await recordEvent(tx, ctx, {
        action: 'attachment.uploaded',
        entityId,
        projectId: null,
        payload: { fileName: file.fileName },
        audit: { action: 'create', resourceType: 'attachment', resourceId: row!.id, changes: null },
      });
      return row!;
    });
  } catch (err) {
    await storage().delete(storageKey).catch(() => {});
    throw err;
  }
}

export async function getAttachmentForDownload(ctx: AuthContext, attachmentId: string): Promise<{ fileName: string; contentType: string; data: Uint8Array }> {
  const [row] = await db()
    .select({ id: attachments.id, entityId: attachments.entityId, fileName: attachments.fileName, contentType: attachments.contentType, storageKey: attachments.storageKey })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.orgId, ctx.orgId), isNull(attachments.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('Attachment');
  await getEntityRef(ctx, row.entityId, { includeDeleted: true }); // re-check tenant access to the parent
  const data = await storage().get(row.storageKey);
  return { fileName: row.fileName, contentType: row.contentType, data };
}

export async function deleteAttachment(ctx: AuthContext, attachmentId: string): Promise<void> {
  const [row] = await db()
    .select({ id: attachments.id, entityId: attachments.entityId, uploadedBy: attachments.uploadedBy, fileName: attachments.fileName })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.orgId, ctx.orgId), isNull(attachments.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('Attachment');
  if (!canDeleteAttachment(actorOf(ctx), row.uploadedBy)) throw new ForbiddenError('You can only delete files you uploaded');

  await db().transaction(async (tx) => {
    await tx.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, attachmentId));
    await recordEvent(tx, ctx, { action: 'attachment.deleted', entityId: row.entityId, projectId: null, activity: false, audit: { action: 'delete', resourceType: 'attachment', resourceId: attachmentId, changes: null } });
  });
}
