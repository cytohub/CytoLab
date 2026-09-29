'use client';

import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/ui/page';

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer className="max-w-lg">
      <div className="mt-16 flex flex-col items-center rounded-lg border border-border bg-surface p-8 text-center shadow-card">
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--tone-red-bg)] text-[var(--tone-red-fg)]">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-fg">Something went wrong</h1>
        <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
          An unexpected error occurred while loading this page. You can try again — if it keeps happening, please let your admin know.
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-fg-faint">Ref: {error.digest}</p>}
        <Button className="mt-5" onClick={reset}>Try again</Button>
      </div>
    </PageContainer>
  );
}
