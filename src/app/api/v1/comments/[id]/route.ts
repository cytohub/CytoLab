import { updateCommentSchema } from '@/domain/schemas/platform';
import { deleteComment, updateComment } from '@/server/modules/collaboration/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api<{ id: string }>(async ({ ctx, req, params }) => {
  const { body } = await parseJson(req, updateCommentSchema);
  return ok(await updateComment(ctx, params.id, body));
});

export const DELETE = api<{ id: string }>(async ({ ctx, params }) => {
  await deleteComment(ctx, params.id);
  return ok({ success: true });
});
