import { updateTeamSchema } from '@/domain/schemas/platform';
import { getTeam, updateTeam } from '@/server/modules/directory/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await getTeam(ctx, params.id)));

export const PATCH = api<{ id: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, updateTeamSchema);
  return ok(await updateTeam(ctx, params.id, input));
}, { publicDemoLock: 'people' });
