'use client';

import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/feedback';
import { api, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { formatRelative } from '@/lib/format';
import { toast } from '@/components/ui/toast';
import type { NotificationItem } from '@/server/modules/notifications/service';

export function NotificationsMenu({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(initialUnread);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, meta } = await api.get<NotificationItem[]>('/notifications', { limit: 12 });
      setItems(data);
      if (meta && typeof meta.unreadCount === 'number') setUnread(meta.unreadCount);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) void load();
    },
    [load],
  );

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read', { all: true });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      void api.post('/notifications/read', { ids: [item.id] }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (item.entity) router.push(item.entity.href);
    else router.push(routes.notifications);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className="relative inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:outline-none"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[var(--tone-red-fg)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold text-fg">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              <Check className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[24rem] overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-fg-muted">You&apos;re all caught up.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openItem(item)}
                    className={cn('flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover', !item.read && 'bg-accent-subtle/40')}
                  >
                    {item.actor ? (
                      <Avatar name={item.actor.name} initials={item.actor.initials} color={item.actor.avatarColor} avatarUrl={item.actor.avatarUrl} size="sm" />
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-surface-hover text-fg-subtle">
                        <Bell className="size-3.5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{item.title}</span>
                      {item.body && <span className="mt-0.5 block line-clamp-2 text-xs text-fg-muted">{item.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-fg-faint">{formatRelative(item.createdAt)}</span>
                    </span>
                    {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-1">
          <button
            onClick={() => {
              setOpen(false);
              router.push(routes.notifications);
            }}
            className="w-full rounded-md px-2 py-1.5 text-center text-sm font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
