import 'server-only';
import { and, desc, eq, isNull, sql, sum } from 'drizzle-orm';
import { ConflictError, ForbiddenError, NotFoundError, PayloadTooLargeError, ValidationError } from '@/domain/errors';
import { MAX_DESCRIPTION_CHARS, normalizeContentType, normalizeFileName } from '@/domain/files';
import { canDeleteAttachment } from '@/domain/permissions';
import { actorOf, type AuthContext } from '../../auth/context';
import { authorize } from '../../authz';
import { db, type Executor } from '../../db/client';
import { attachments, users } from '../../db/schema';
import { env } from '../../env';
import { RateLimiter } from '../../http/rate-limit';
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

/** 60 uploads per hour per person. */
const uploadLimiter = new RateLimiter(60, 60 * 60 * 1000, 'You are uploading files faster than allowed. Try again later.');

async function assertUploadTarget(ctx: AuthContext, entityId: string): Promise<void> {
  authorize(ctx, 'attachment:upload');
  await getEntityRef(ctx, entityId);
}

/**
 * Checked before an upload body is read, so a refused upload costs nothing.
 * This is where an upload counts against the hourly limit: call it once per
 * upload, before `createAttachment`.
 */
export async function assertCanUpload(ctx: AuthContext, entityId: string): Promise<void> {
  await assertUploadTarget(ctx, entityId);
  uploadLimiter.consume(ctx.userId);
}

/**
 * Bytes an organization stores, deleted attachments included: deletion is a
 * soft delete, so their files stay on disk for the record.
 */
async function storedBytes(executor: Executor, orgId: string): Promise<number> {
  const [row] = await executor.select({ total: sum(attachments.sizeBytes) }).from(attachments).where(eq(attachments.orgId, orgId));
  return Number(row?.total ?? 0);
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
  await assertUploadTarget(ctx, entityId);

  if (file.data.byteLength === 0) throw new ValidationError('The file is empty', { file: ['Choose a non-empty file'] });
  if (file.data.byteLength > env().MAX_UPLOAD_BYTES) throw new PayloadTooLargeError(env().MAX_UPLOAD_BYTES);
  const contentType = normalizeContentType(file.contentType);
  if (!isAllowedType(contentType)) throw new ValidationError('That file type is not allowed', { file: [`Unsupported type: ${contentType}`] });
  const fileName = normalizeFileName(file.fileName);
  const description = file.description?.replace(/\u0000/g, '').trim() || null;
  if (description && description.length > MAX_DESCRIPTION_CHARS) {
    throw new ValidationError('The description is too long', { description: [`Must be at most ${MAX_DESCRIPTION_CHARS} characters`] });
  }

  const quota = env().MAX_ORG_STORAGE_BYTES;
  const storageKey = newStorageKey(ctx.orgId);
  let stored = false;

  try {
    return await db().transaction(async (tx) => {
      // Uploads to one organization pass the quota check one at a time, so
      // simultaneous uploads cannot each fit under the same total.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`attachment-quota:${ctx.orgId}`}))`);
      const used = await storedBytes(tx, ctx.orgId);
      if (used + file.data.byteLength > quota) {
        throw new ConflictError('This organization has used its file storage allowance', { limitBytes: quota, usedBytes: used });
      }

      stored = true; // from here on a failure also removes a partly written file
      await storage().put(storageKey, file.data, contentType);
      const [row] = await tx
        .insert(attachments)
        .values({
          orgId: ctx.orgId,
          entityId,
          fileName,
          contentType,
          sizeBytes: file.data.byteLength,
          storageKey,
          checksumSha256: sha256(file.data),
          description,
          uploadedBy: ctx.userId,
        })
        .returning({ id: attachments.id });
      await recordEvent(tx, ctx, {
        action: 'attachment.uploaded',
        entityId,
        projectId: null,
        payload: { fileName },
        audit: { action: 'create', resourceType: 'attachment', resourceId: row!.id, changes: null },
      });
      return row!;
    });
  } catch (err) {
    if (stored) await storage().delete(storageKey).catch(() => {});
    throw err;
  }
}

export async function getAttachmentForDownload(ctx: AuthContext, attachmentId: string): Promise<{ fileName: string; contentType: string; body: ReadableStream<Uint8Array>; size: number }> {
  const [row] = await db()
    .select({ id: attachments.id, entityId: attachments.entityId, fileName: attachments.fileName, contentType: attachments.contentType, storageKey: attachments.storageKey })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.orgId, ctx.orgId), isNull(attachments.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('Attachment');
  await getEntityRef(ctx, row.entityId, { includeDeleted: true }); // re-check tenant access to the parent
  const { body, size } = await storage().open(row.storageKey);
  return { fileName: row.fileName, contentType: row.contentType, body, size };
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
