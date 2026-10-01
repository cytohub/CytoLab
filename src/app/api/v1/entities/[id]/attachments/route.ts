import { BadRequestError, UnsupportedMediaTypeError, ValidationError } from '@/domain/errors';
import { assertCanUpload, createAttachment, listAttachments } from '@/server/modules/collaboration/attachments';
import { env } from '@/server/env';
import { api, created, ok, readBodyCapped } from '@/server/http/api';

/** Room for multipart boundaries, part headers and the description field. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await listAttachments(ctx, params.id)));

export const POST = api<{ id: string }>(async ({ ctx, req, params }) => {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) throw new UnsupportedMediaTypeError('Upload files as multipart/form-data');

  // Refuse before reading a byte: permission and target first, then a body
  // counted as it streams in (Content-Length alone can be omitted or wrong).
  await assertCanUpload(ctx, params.id);
  const maxBytes = env().MAX_UPLOAD_BYTES;
  const body = await readBodyCapped(req, maxBytes + MULTIPART_OVERHEAD_BYTES, maxBytes);

  let form: FormData;
  try {
    form = await new Response(body as unknown as BodyInit, { headers: { 'content-type': contentType } }).formData();
  } catch {
    throw new BadRequestError('The upload could not be read as multipart/form-data');
  }
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
