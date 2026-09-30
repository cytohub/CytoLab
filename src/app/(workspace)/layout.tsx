import { toSessionInfo } from '@/server/auth/context';
import { requireServerAuth } from '@/server/auth/request';
import { env } from '@/server/env';
import { unreadNotificationCount } from '@/server/modules/notifications/service';
import { AppShell } from '@/components/shell/app-shell';
import { SyntheticDataBanner } from '@/components/shell/synthetic-banner';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireServerAuth();
  const unread = await unreadNotificationCount(ctx);

  return (
    <AppShell session={toSessionInfo(ctx)} unreadNotifications={unread}>
      {ctx.org.isDemo && <SyntheticDataBanner resetsNightly={env().PUBLIC_DEMO} />}
      {children}
    </AppShell>
  );
}
