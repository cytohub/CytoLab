'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';
import type { SessionInfo } from '@/server/auth/context';
import { CommandPaletteProvider } from './command-palette';
import { SessionProvider } from './session-context';
import { SidebarNav } from './sidebar';
import { TopBar } from './topbar';

interface AppShellProps {
  session: SessionInfo;
  unreadNotifications: number;
  children: React.ReactNode;
}

export function AppShell({ session, unreadNotifications, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // The drawer is closed via SidebarNav's onNavigate when a link is tapped, so
  // no navigation effect is needed.
  return (
    <SessionProvider value={{ ...session, unreadNotifications }}>
      <CommandPaletteProvider>
        <div className="flex min-h-dvh">
          {/* Desktop sidebar */}
          <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-surface lg:block">
            <SidebarNav orgName={session.org.name} />
          </aside>

          {/* Mobile drawer */}
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[1px] lg:hidden data-[state=open]:animate-in" />
              <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface lg:hidden focus:outline-none data-[state=open]:animate-in">
                <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                <SidebarNav orgName={session.org.name} onNavigate={() => setMobileOpen(false)} />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
            <TopBar onOpenSidebar={() => setMobileOpen(true)} />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </CommandPaletteProvider>
    </SessionProvider>
  );
}
