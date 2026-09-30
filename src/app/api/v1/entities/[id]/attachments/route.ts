import { PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from '@/domain/errors';
import { createAttachment, listAttachments } from '@/server/modules/collaboration/attachments';
import { env } from '@/server/env';
import { api, created, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await listAttachments(ctx, params.id)));

export const POST = api<{ id: string }>(async ({ ctx, req, params }) => {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) throw new UnsupportedMediaTypeError('Upload files as multipart/form-data');

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > env().MAX_UPLOAD_BYTES + 8192) throw new PayloadTooLargeError(env().MAX_UPLOAD_BYTES);

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('No file was provided', { file: ['Attach a file'] });

  const description = form.get('description');
  const data = new Uint8Array(await file.arrayBuffer());
  const result = await createAttachment(ctx, params.id, {
    fileName: file.name || 'upload',
    contentType: file.type || 'application/octet-stream',
    data,
    description: typeof description === 'string' ? description : null,
  });
  return created(result);
}, { publicDemoLock: 'files' });
