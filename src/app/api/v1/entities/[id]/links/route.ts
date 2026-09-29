import { createLinkSchema } from '@/domain/schemas/platform';
import { createLink, listLinks } from '@/server/modules/collaboration/service';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await listLinks(ctx, params.id)));

export const POST = api<{ id: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, createLinkSchema);
  return created(await createLink(ctx, params.id, input));
});
