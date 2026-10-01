import { downloadContentType } from '@/domain/files';
import { getAttachmentForDownload } from '@/server/modules/collaboration/attachments';
import { api } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => {
  const file = await getAttachmentForDownload(ctx, params.id);
  // Force download and prevent content sniffing; never render untrusted uploads inline.
  const asciiName = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new Response(file.body, {
    headers: {
      'content-type': downloadContentType(file.contentType),
      'content-length': String(file.size),
      'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'x-content-type-options': 'nosniff',
      // If a browser ever renders the file anyway, it gets no scripts and no origin.
      'content-security-policy': "default-src 'none'; sandbox",
      'cache-control': 'private, no-store',
    },
  });
});
