import { deleteAttachment } from '@/server/modules/collaboration/attachments';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = api<{ id: string }>(async ({ ctx, params }) => {
  await deleteAttachment(ctx, params.id);
  return ok({ success: true });
}, { publicDemoLock: 'files' });
