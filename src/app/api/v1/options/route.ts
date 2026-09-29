import { listResearchAreas, listExperimentTypes } from '@/server/modules/config/service';
import { memberOptions, teamOptions } from '@/server/modules/directory/service';
import { listTags } from '@/server/modules/collaboration/service';
import { api, ok } from '@/server/http/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lookup lists for form pickers (assignees, teams, types, tags, areas). */
export const GET = api(async ({ ctx }) => {
  const [members, teams, experimentTypes, tags, researchAreas] = await Promise.all([
    memberOptions(ctx),
    teamOptions(ctx),
    listExperimentTypes(ctx),
    listTags(ctx),
    listResearchAreas(ctx),
  ]);
  return ok({
    members,
    teams,
    experimentTypes: experimentTypes.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name, category: t.category, color: t.color })),
    tags,
    researchAreas,
  });
});
