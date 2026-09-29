import { addTeamMemberSchema } from '@/domain/schemas/platform';
import { addTeamMember } from '@/server/modules/directory/service';
import { api, created, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api<{ id: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, addTeamMemberSchema);
  return created(await addTeamMember(ctx, params.id, input));
});
