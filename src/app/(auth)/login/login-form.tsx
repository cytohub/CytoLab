'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Field, Input } from '@/components/ui/field';
import { InlineError } from '@/components/ui/feedback';
import { api, ApiClientError } from '@/lib/api-client';
import { routes } from '@/lib/routes';
import type { DemoAccount } from '@/server/modules/auth/service';

interface DemoData {
  enabled: boolean;
  password: string | null;
  accounts: DemoAccount[];
}

export function LoginForm({ demo }: { demo: DemoData }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = React.useCallback(
    async (values: { email: string; password: string }) => {
      setError(null);
      setPending(true);
      try {
        await api.post('/auth/login', values);
        router.push(routes.dashboard);
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.');
        setPending(false);
      }
    },
    [router],
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit({ email, password });
        }}
        className="space-y-4"
      >
        {error && <InlineError>{error}</InlineError>}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lab.example" autoFocus />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>

      {demo.enabled && demo.accounts.length > 0 && (
        <div className="mt-6">
          <div className="relative mb-3 text-center">
            <span className="relative z-10 bg-surface px-2 text-xs text-fg-subtle">Or continue as a demo user</span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <div className="grid gap-1.5">
            {demo.accounts.map((account) => (
              <button
                key={account.user.id}
                type="button"
                disabled={pending}
                onClick={() => {
                  setEmail(account.user.email);
                  setPassword(demo.password ?? '');
                  void submit({ email: account.user.email, password: demo.password ?? '' });
                }}
                className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-60"
              >
                <Avatar name={account.user.name} initials={account.user.initials} color={account.user.avatarColor} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{account.user.name}</span>
                  <span className="block truncate text-xs text-fg-muted">{account.user.title}</span>
                </span>
                <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium capitalize text-fg-subtle">{account.role.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
