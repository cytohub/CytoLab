import type { Metadata } from 'next';
import { requireServerAuth } from '@/server/auth/request';
import { getAnalytics } from '@/server/modules/insights/service';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { ProgressView } from '@/components/analytics/progress-view';

export const metadata: Metadata = { title: 'Research Progress' };
export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const ctx = await requireServerAuth();
  const analytics = await getAnalytics(ctx, { range: '180d', granularity: 'week' });

  return (
    <PageContainer>
      <PageHeader title="Research progress" description="Throughput, success rates and completion times across your programs." />
      <ProgressView initial={analytics} />
    </PageContainer>
  );
}
