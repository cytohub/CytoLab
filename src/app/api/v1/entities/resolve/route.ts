import { z } from 'zod';
import { resolveDisplayId } from '@/server/platform/entities';
import { api, ok, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ displayId: z.string().trim().min(1).max(40) });

export const GET = api(async ({ ctx, req }) => {
  const { displayId } = parseQuery(req, schema);
  return ok(await resolveDisplayId(ctx, displayId));
});
