'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { Settings } from 'lucide-react';
import { NAV_GROUPS, type NavItem } from './nav-config';

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return item.match?.some((m) => pathname.startsWith(m)) ?? false;
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  if (item.comingSoon) {
    return (
      <span
        className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-fg-faint"
        title="Coming soon"
        aria-disabled
      >
        <item.icon className="size-[18px] shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        <span className="rounded bg-surface-hover px-1.5 py-px text-[10px] font-medium text-fg-subtle">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
      )}
    >
      <item.icon className={cn('size-[18px] shrink-0', active ? 'text-accent' : 'text-fg-subtle')} />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarNav({ orgName, onNavigate }: { orgName: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Link href={routes.dashboard} className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-fg">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V3" />
              <path d="M7.5 15h9M9 3h6" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-fg">CytoLab</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-fg-faint uppercase">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-2">
        <NavLink item={{ label: 'Settings', href: routes.settings, icon: Settings }} pathname={pathname} onNavigate={onNavigate} />
        <div className="truncate px-2.5 pt-2 text-[11px] text-fg-faint">{orgName}</div>
      </div>
    </div>
  );
}

