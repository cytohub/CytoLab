import { removeTeamMember } from '@/server/modules/directory/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = api<{ id: string; userId: string }>(async ({ ctx, params }) => {
  await removeTeamMember(ctx, params.id, params.userId);
  return ok({ success: true });
});
