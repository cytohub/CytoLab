'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { ActivityList } from '@/components/domain/activity-item';
import { Activity } from 'lucide-react';
import { api, errorMessage } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import type { ActivityItem } from '@/server/modules/activity/service';

/** Cursor-paginated activity feed. `params` are passed through to /api/v1/activity. */
export function ActivityFeed({
  initialItems,
  initialCursor,
  params = {},
  emptyLabel = 'No activity yet.',
}: {
  initialItems: ActivityItem[];
  initialCursor: string | null;
  params?: Record<string, string>;
  emptyLabel?: string;
}) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const { data, meta } = await api.get<ActivityItem[]>('/activity', { ...params, before: cursor, limit: 30 });
      setItems((prev) => [...prev, ...data]);
      setCursor((meta?.nextCursor as string | null) ?? null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return <EmptyState icon={<Activity />} title="No activity" description={emptyLabel} />;
  }

  return (
    <div>
      <ActivityList items={items} />
      {cursor && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" size="sm" loading={loading} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
