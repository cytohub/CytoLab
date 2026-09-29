'use client';

import * as React from 'react';
import type { SessionInfo } from '@/server/auth/context';
import type { Permission } from '@/domain/permissions';

interface SessionContextValue extends SessionInfo {
  unreadNotifications: number;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ value, children }: { value: SessionContextValue; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}

export function usePermission(permission: Permission): boolean {
  const { permissions } = useSession();
  return permissions.includes(permission);
}
