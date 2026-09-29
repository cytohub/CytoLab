import { updateMilestoneSchema } from '@/domain/schemas/projects';
import { deleteMilestone, updateMilestone } from '@/server/modules/projects/milestones';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api<{ id: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, updateMilestoneSchema);
  return ok(await updateMilestone(ctx, params.id, input));
});

export const DELETE = api<{ id: string }>(async ({ ctx, params }) => {
  await deleteMilestone(ctx, params.id);
  return ok({ success: true });
});
