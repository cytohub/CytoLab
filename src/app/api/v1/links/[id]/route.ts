import { deleteLink } from '@/server/modules/collaboration/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = api<{ id: string }>(async ({ ctx, params }) => {
  await deleteLink(ctx, params.id);
  return ok({ success: true });
});
