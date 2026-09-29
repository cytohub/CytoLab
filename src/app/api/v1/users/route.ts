import { createMemberSchema } from '@/domain/schemas/platform';
import { createMember, listMembers } from '@/server/modules/directory/service';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => ok(await listMembers(ctx)));

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, createMemberSchema);
  return created(await createMember(ctx, input));
});
