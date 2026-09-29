import { PageContainer, PageHeader } from '@/components/ui/page';
import { requireServerAuth } from '@/server/auth/request';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const ctx = await requireServerAuth();
  return (
    <PageContainer>
      <PageHeader title="R&D Overview" description={`Welcome back, ${ctx.user.name.split(' ').slice(-1)[0]}.`} />
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-fg-muted">
        Dashboard content coming next.
      </div>
    </PageContainer>
  );
}
