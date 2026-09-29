import { listDemoAccounts } from '@/server/modules/auth/service';
import { ok, publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = publicApi(async () => ok(await listDemoAccounts()));
