import { listResearchAreas } from '@/server/modules/config/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => ok(await listResearchAreas(ctx)));
