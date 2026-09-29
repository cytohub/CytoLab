import { timingSafeEqual } from 'node:crypto';
import { ForbiddenError } from '@/domain/errors';
import { env } from '@/server/env';
import { runAttentionScan } from '@/server/modules/jobs/attention-scan';
import { ok, publicApi } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Trigger endpoint for the attention scan. Guarded by a shared secret (Bearer token). */
export const POST = publicApi(async ({ req }) => {
  const secret = env().INTERNAL_JOB_SECRET;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = secret ?? '';
  const ok401 =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok401) throw new ForbiddenError('Invalid job token');
  return ok(await runAttentionScan());
});
