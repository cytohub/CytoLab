import { createMilestoneSchema } from '@/domain/schemas/projects';
import { getProject } from '@/server/modules/projects/service';
import { createMilestone } from '@/server/modules/projects/milestones';
import { api, created, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ ref: string }>(async ({ ctx, params }) => {
  const project = await getProject(ctx, params.ref);
  return ok(project.milestones);
});

export const POST = api<{ ref: string }>(async ({ ctx, req, params }) => {
  const project = await getProject(ctx, params.ref);
  const input = await parseJson(req, createMilestoneSchema);
  return created(await createMilestone(ctx, project.id, input));
});
