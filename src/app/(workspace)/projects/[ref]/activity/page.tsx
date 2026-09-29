import { requireServerAuth } from '@/server/auth/request';
import { getProject } from '@/server/modules/projects/service';
import { listActivity } from '@/server/modules/activity/service';
import { Card, CardContent } from '@/components/ui/card';
import { ActivityFeed } from '@/components/activity/activity-feed';

export const dynamic = 'force-dynamic';

export default async function ProjectActivityPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const project = await getProject(ctx, ref);
  const feed = await listActivity(ctx, { projectId: project.id, limit: 30 });

  return (
    <Card>
      <CardContent className="pt-5">
        <ActivityFeed initialItems={feed.items} initialCursor={feed.nextCursor} params={{ projectId: project.id }} emptyLabel="Activity on this project will appear here." />
      </CardContent>
    </Card>
  );
}
