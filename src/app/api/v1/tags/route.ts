import { createTagSchema } from '@/domain/schemas/platform';
import { createTag, listTags } from '@/server/modules/collaboration/service';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => ok(await listTags(ctx)));

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, createTagSchema);
  return created(await createTag(ctx, input));
});
