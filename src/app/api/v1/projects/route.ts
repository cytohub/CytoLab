import { createProjectSchema, listProjectsQuerySchema } from '@/domain/schemas/projects';
import { createProject, listProjects } from '@/server/modules/projects/service';
import { api, created, ok, parseJson, parseQuery } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async ({ ctx, req }) => {
  const query = parseQuery(req, listProjectsQuerySchema);
  const { items, meta } = await listProjects(ctx, query);
  return ok(items, meta);
});

export const POST = api(async ({ ctx, req }) => {
  const input = await parseJson(req, createProjectSchema);
  return created(await createProject(ctx, input));
});
