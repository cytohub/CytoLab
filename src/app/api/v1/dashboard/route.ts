import { getDashboard } from '@/server/modules/insights/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx }) => ok(await getDashboard(ctx)));
