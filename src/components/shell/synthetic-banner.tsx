'use client';

import { X } from 'lucide-react';
import * as React from 'react';

const STORAGE_KEY = 'bioengine.demo-banner.dismissed';

/** Persistent notice that all data is synthetic. Dismissal is per-browser only. */
export function SyntheticDataBanner() {
  const [dismissed, setDismissed] = React.useState(true);

  // Read the per-browser dismissal from localStorage after mount (unavailable
  // during SSR). This synchronizes from an external store, so the setState is
  // intentional here.
  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-[color:var(--tone-amber-fg)]/20 bg-[var(--tone-amber-bg)] px-4 py-1.5 text-center text-xs text-[color:var(--tone-amber-fg)]">
      <span>
        <strong className="font-semibold">Demo workspace.</strong> All projects, experiments, people and results are synthetic — not real scientific data.
      </span>
      <button
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, '1');
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        className="rounded p-0.5 hover:bg-black/5"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
