import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuth } from '@/server/auth/request';
import { env } from '@/server/env';
import { listDemoAccounts } from '@/server/modules/auth/service';
import { routes } from '@/lib/routes';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const ctx = await getServerAuth();
  if (ctx) redirect(routes.dashboard);
  const demo = await listDemoAccounts();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V3" />
              <path d="M7.5 15h9M9 3h6" />
            </svg>
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Sign in to CytoLab</h1>
          <p className="mt-1 text-sm text-fg-muted">Your life-science R&D workspace</p>
        </div>

        <LoginForm demo={demo} />

        <p className="mt-6 text-center text-xs text-fg-faint">
          {env().PUBLIC_DEMO
            ? 'Public demo with synthetic data. Changes reset every night. Not for real scientific records.'
            : 'Demo workspace with synthetic data. Not for real scientific records.'}
        </p>
      </div>
    </div>
  );
}
