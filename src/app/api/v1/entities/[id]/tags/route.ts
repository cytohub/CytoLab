import { setTagsSchema } from '@/domain/schemas/platform';
import { setEntityTags } from '@/server/modules/collaboration/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = api<{ id: string }>(async ({ ctx, req, params }) => {
  const { tagIds } = await parseJson(req, setTagsSchema);
  return ok(await setEntityTags(ctx, params.id, tagIds));
});
