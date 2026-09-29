import { getEntityRef } from '@/server/platform/entities';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await getEntityRef(ctx, params.id, { includeDeleted: true })));
