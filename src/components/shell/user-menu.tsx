'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_META } from '@/domain/labels';
import { api, errorMessage } from '@/lib/api-client';
import { routes } from '@/lib/routes';
import { toast } from '@/components/ui/toast';
import { useSession } from './session-context';

export function UserMenu() {
  const router = useRouter();
  const { user, org, role } = useSession();
  const [loading, setLoading] = React.useState(false);

  const signOut = async () => {
    setLoading(true);
    try {
      await api.post('/auth/logout');
      router.push(routes.login);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]" aria-label="Account menu">
        <Avatar name={user.name} color={user.avatarColor} avatarUrl={user.avatarUrl} size="md" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[15rem]">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name={user.name} color={user.avatarColor} avatarUrl={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-fg">{user.name}</div>
            <div className="truncate text-xs text-fg-muted">{user.email}</div>
            <div className="mt-0.5 text-[11px] text-fg-subtle">
              {ROLE_META[role].label} · {org.name}
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(routes.member(user.id))}>
          <UserIcon /> Your profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(routes.settings)}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={(e) => { e.preventDefault(); void signOut(); }} disabled={loading}>
          <LogOut /> {loading ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
        <DropdownMenuLabel className="pt-2 font-normal text-fg-faint">Demo workspace · synthetic data</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
