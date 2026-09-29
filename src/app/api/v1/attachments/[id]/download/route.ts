import { getAttachmentForDownload } from '@/server/modules/collaboration/attachments';
import { api } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => {
  const file = await getAttachmentForDownload(ctx, params.id);
  // Force download and prevent content sniffing; never render untrusted uploads inline.
  const asciiName = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new Response(file.data as unknown as BodyInit, {
    headers: {
      'content-type': file.contentType,
      'content-length': String(file.data.byteLength),
      'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
});
