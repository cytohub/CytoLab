import { getProject } from '@/server/modules/projects/service';
import { listExperimentsForProject } from '@/server/modules/experiments/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ ref: string }>(async ({ ctx, params }) => {
  const project = await getProject(ctx, params.ref);
  return ok(await listExperimentsForProject(ctx, project.id));
});
