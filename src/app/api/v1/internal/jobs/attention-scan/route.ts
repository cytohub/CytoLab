import { createHash, timingSafeEqual } from 'node:crypto';
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
  // Comparing fixed-length digests reveals nothing about the secret's length.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!secret || !timingSafeEqual(digest(provided), digest(secret))) throw new ForbiddenError('Invalid job token');
  return ok(await runAttentionScan());
});
