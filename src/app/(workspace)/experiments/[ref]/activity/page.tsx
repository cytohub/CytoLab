import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { listActivity } from '@/server/modules/activity/service';
import { Card, CardContent } from '@/components/ui/card';
import { ActivityFeed } from '@/components/activity/activity-feed';

export const dynamic = 'force-dynamic';

export default async function ExperimentActivityPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);
  const feed = await listActivity(ctx, { entityId: exp.id, limit: 30 });
  return (
    <Card><CardContent className="pt-5">
      <ActivityFeed initialItems={feed.items} initialCursor={feed.nextCursor} params={{ entityId: exp.id }} emptyLabel="Activity on this experiment will appear here." />
    </CardContent></Card>
  );
}
