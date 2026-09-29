'use client';

import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { api, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { toast } from '@/components/ui/toast';
import type { NotificationItem } from '@/server/modules/notifications/service';

export function NotificationsInbox({ initialItems, initialCursor, initialUnread }: { initialItems: NotificationItem[]; initialCursor: string | null; initialUnread: number }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [unread, setUnread] = React.useState(initialUnread);
  const [loading, setLoading] = React.useState(false);

  const markAll = async () => {
    try {
      await api.post('/notifications/read', { all: true });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const open = (item: NotificationItem) => {
    if (!item.read) {
      void api.post('/notifications/read', { ids: [item.id] }).catch(() => {});
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (item.entity) router.push(item.entity.href);
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const { data, meta } = await api.get<NotificationItem[]>('/notifications', { before: cursor, limit: 20 });
      setItems((prev) => [...prev, ...data]);
      setCursor((meta?.nextCursor as string | null) ?? null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return <EmptyState icon={<Bell />} title="No notifications" description="Assignments, status changes and mentions will show up here." />;
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={markAll}>
            <Check /> Mark all read
          </Button>
        </div>
      )}
      <Card>
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <button onClick={() => open(item)} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover', !item.read && 'bg-accent-subtle/40')}>
                {item.actor ? (
                  <Avatar name={item.actor.name} initials={item.actor.initials} color={item.actor.avatarColor} avatarUrl={item.actor.avatarUrl} size="md" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-surface-hover text-fg-subtle"><Bell className="size-4" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-fg">{item.title}</div>
                  {item.body && <div className="mt-0.5 text-sm text-fg-muted">{item.body}</div>}
                  <div className="mt-1 text-xs text-fg-faint">{formatRelative(item.createdAt)}</div>
                </div>
                {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {cursor && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" loading={loading} onClick={loadMore}>Load more</Button>
        </div>
      )}
    </div>
  );
}
