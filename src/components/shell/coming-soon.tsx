import * as React from 'react';
import { Check } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Card } from '@/components/ui/card';

/** Placeholder for future modules — communicates the roadmap without a dead end. */
export function ComingSoon({ icon, title, description, capabilities, phase }: { icon: React.ReactNode; title: string; description: string; capabilities: string[]; phase: string }) {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title={title} description={description} />
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-accent-subtle text-accent [&_svg]:size-6">{icon}</span>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-fg-subtle">Coming soon · {phase}</div>
            <h2 className="mt-1 text-base font-semibold text-fg">{title} module</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          This module is part of the BioEngine roadmap. The data model and API already reserve first-class objects for it, so it will connect to your existing projects and experiments when it ships.
        </p>
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Planned capabilities</div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {capabilities.map((c) => (
              <li key={c} className="flex items-center gap-2 text-sm text-fg-muted">
                <Check className="size-4 shrink-0 text-[var(--tone-green-fg)]" /> {c}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </PageContainer>
  );
}
