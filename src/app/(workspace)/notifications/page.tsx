import type { Metadata } from 'next';
import { requireServerAuth } from '@/server/auth/request';
import { listNotifications } from '@/server/modules/notifications/service';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { NotificationsInbox } from '@/components/notifications/notifications-inbox';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const ctx = await requireServerAuth();
  const result = await listNotifications(ctx, { limit: 25 });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Notifications" description={result.unreadCount > 0 ? `${result.unreadCount} unread` : "You're all caught up."} />
      <NotificationsInbox initialItems={result.items} initialCursor={result.nextCursor} initialUnread={result.unreadCount} />
    </PageContainer>
  );
}
