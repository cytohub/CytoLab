import Link from 'next/link';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import type { ActivityItem as Activity } from '@/server/modules/activity/service';

/** Turns a structured activity event into a readable sentence. */
function phrase(item: Activity): React.ReactNode {
  const p = item.payload as Record<string, string>;
  const target = item.entity ? (
    <Link href={item.entity.href} className="font-medium text-fg hover:underline">
      {item.entity.displayId !== item.entity.title ? `${item.entity.displayId} · ${item.entity.title}` : item.entity.title}
    </Link>
  ) : null;

  switch (item.action) {
    case 'project.created':
      return <>created project {target}</>;
    case 'project.status_changed':
      return <>moved {target} to <em className="not-italic text-fg">{p.to?.replace('_', ' ')}</em></>;
    case 'project.updated':
      return <>updated {target}</>;
    case 'project.deleted':
      return <>deleted project {p.code}</>;
    case 'milestone.completed':
      return <>reached milestone <span className="font-medium text-fg">{p.milestone}</span> — {p.title} on {target}</>;
    case 'milestone.created':
      return <>added milestone {p.milestone} to {target}</>;
    case 'experiment.created':
      return <>created experiment {target}</>;
    case 'experiment.status_changed':
      return <>changed {target} from <em className="not-italic">{p.from?.replace('_', ' ')}</em> to <em className="not-italic font-medium text-fg">{p.to?.replace('_', ' ')}</em></>;
    case 'experiment.updated':
      return <>updated {target}</>;
    case 'experiment.deleted':
      return <>deleted experiment {p.displayId}</>;
    case 'result.recorded':
      return <>recorded results on {target}</>;
    case 'observation.recorded':
      return <>logged an observation on {target}</>;
    case 'comment.created':
      return <>commented on {target}</>;
    case 'sample.linked':
      return <>linked a sample to {target}</>;
    case 'attachment.uploaded':
      return <>uploaded {p.fileName ? <span className="text-fg">{p.fileName}</span> : 'a file'} to {target}</>;
    case 'link.created':
      return <>linked {target} to {p.targetDisplayId}</>;
    default:
      return <>{item.action.replace(/\./g, ' ').replace(/_/g, ' ')} {target}</>;
  }
}

export function ActivityRow({ item, showConnector = true }: { item: Activity; showConnector?: boolean }) {
  const actorName = item.actor?.name ?? (item.actorType === 'system' ? 'System' : 'Someone');
  return (
    <li className="relative flex gap-3">
      {showConnector && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />}
      {item.actor ? (
        <Avatar name={item.actor.name} initials={item.actor.initials} color={item.actor.avatarColor} avatarUrl={item.actor.avatarUrl} size="md" className="z-10" />
      ) : (
        <span className="z-10 flex size-8 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-fg-subtle">SYS</span>
      )}
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-sm leading-snug text-fg-muted">
          <span className="font-medium text-fg">{actorName}</span> {phrase(item)}
        </p>
        <time className="text-xs text-fg-faint" dateTime={item.occurredAt} title={new Date(item.occurredAt).toLocaleString()}>
          {formatRelative(item.occurredAt)}
        </time>
      </div>
    </li>
  );
}

export function ActivityList({ items, className }: { items: Activity[]; className?: string }) {
  return (
    <ul className={cn('space-y-0', className)}>
      {items.map((item, i) => (
        <ActivityRow key={item.id} item={item} showConnector={i < items.length - 1} />
      ))}
    </ul>
  );
}
