import { createCommentSchema } from '@/domain/schemas/platform';
import { createComment, listComments } from '@/server/modules/collaboration/service';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await listComments(ctx, params.id)));

export const POST = api<{ id: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, createCommentSchema);
  return created(await createComment(ctx, params.id, input));
});
