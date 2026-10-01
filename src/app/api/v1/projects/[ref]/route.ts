import { updateProjectSchema } from '@/domain/schemas/projects';
import { deleteProject, getProject, updateProject } from '@/server/modules/projects/service';
import { api, ok, parseJson } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api<{ ref: string }>(async ({ ctx, params }) => ok(await getProject(ctx, params.ref)));

export const PATCH = api<{ ref: string }>(async ({ ctx, req, params }) => {
  const input = await parseJson(req, updateProjectSchema);
  return ok(await updateProject(ctx, params.ref, input));
});

export const DELETE = api<{ ref: string }>(async ({ ctx, params }) => {
  await deleteProject(ctx, params.ref);
  return ok({ success: true });
}, { publicDemoLock: 'records' });
