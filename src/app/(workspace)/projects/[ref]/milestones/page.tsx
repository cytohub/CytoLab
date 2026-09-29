import { requireServerAuth } from '@/server/auth/request';
import { getProject } from '@/server/modules/projects/service';
import { MilestoneManager } from '@/components/projects/milestone-manager';

export const dynamic = 'force-dynamic';

export default async function ProjectMilestonesPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const project = await getProject(ctx, ref);
  return <MilestoneManager projectCode={project.code} milestones={project.milestones} canManage={project.permissions.canManageMilestones} />;
}
