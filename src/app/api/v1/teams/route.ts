import { createTeamSchema } from '@/domain/schemas/platform';
import { createTeam, listTeams } from '@/server/modules/directory/service';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => ok(await listTeams(ctx)));

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, createTeamSchema);
  return created(await createTeam(ctx, input));
}, { publicDemoLock: 'people' });
