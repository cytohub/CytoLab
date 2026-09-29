import type { Metadata } from 'next';
import { requireServerAuth } from '@/server/auth/request';
import { listActivity } from '@/server/modules/activity/service';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { ActivityFeed } from '@/components/activity/activity-feed';

export const metadata: Metadata = { title: 'Activity' };
export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const ctx = await requireServerAuth();
  const feed = await listActivity(ctx, { limit: 40 });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Activity" description="Everything happening across your research workspace." />
      <Card>
        <CardContent className="pt-5">
          <ActivityFeed initialItems={feed.items} initialCursor={feed.nextCursor} emptyLabel="Activity across your workspace will appear here." />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
