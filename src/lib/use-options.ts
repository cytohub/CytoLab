'use client';

import * as React from 'react';
import { api } from './api-client';

export interface FormOptions {
  members: Array<{ id: string; name: string; title: string | null; avatarColor: string; initials: string }>;
  teams: Array<{ id: string; name: string; color: string }>;
  experimentTypes: Array<{ id: string; name: string; category: string; color: string }>;
  tags: Array<{ id: string; name: string; color: string }>;
  researchAreas: Array<{ id: string; name: string; color: string }>;
}

let cache: FormOptions | null = null;
let inflight: Promise<FormOptions> | null = null;

/** Fetches the form pickers once per session and caches the result in memory. */
export function useFormOptions(enabled = true): { options: FormOptions | null; loading: boolean } {
  const [options, setOptions] = React.useState<FormOptions | null>(cache);
  const [loading, setLoading] = React.useState(enabled && !cache);

  React.useEffect(() => {
    if (!enabled || cache) return;
    let active = true;
    inflight ??= api.get<FormOptions>('/options').then((r) => {
      cache = r.data;
      return r.data;
    });
    inflight
      .then((data) => {
        if (active) {
          setOptions(data);
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [enabled]);

  return { options, loading };
}

export function clearOptionsCache() {
  cache = null;
  inflight = null;
}
