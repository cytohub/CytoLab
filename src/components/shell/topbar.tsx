'use client';

import { Menu, Search } from 'lucide-react';
import * as React from 'react';
import { ThemeToggle } from './theme';
import { NotificationsMenu } from './notifications-menu';
import { UserMenu } from './user-menu';
import { useCommandPalette } from './command-palette';
import { useSession } from './session-context';

export function TopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { setOpen } = useCommandPalette();
  const { unreadNotifications } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg-faint transition-colors hover:border-border-strong"
        aria-label="Search (Command or Control K)"
      >
        <Search className="size-4 text-fg-subtle" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle sm:inline-flex">⌘K</kbd>
      </button>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationsMenu initialUnread={unreadNotifications} />
        <div className="mx-1 h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
