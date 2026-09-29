'use client';

import { Command } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { ArrowRight, CornerDownLeft, FlaskConical, FolderKanban, Search, User as UserIcon } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import type { SearchResults } from '@/server/modules/search/service';
import { NAV_DESTINATIONS } from './nav-config';

const typeIcon = { project: FolderKanban, experiment: FlaskConical, user: UserIcon } as const;

interface PaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const PaletteContext = React.createContext<PaletteContextValue | null>(null);
export function useCommandPalette() {
  const ctx = React.useContext(PaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setResults(null);
      setLoading(false);
    }
  }, []);

  const onQueryChange = React.useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults(null);
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<SearchResults>('/search', { q: term, limit: 5 }, controller.signal);
        setResults(data);
      } catch (err) {
        if (!(err instanceof DOMException)) setResults({ query: term, total: 0, groups: [] });
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const navMatches = NAV_DESTINATIONS.filter((d) => d.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <PaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[1px] data-[state=open]:animate-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-panel shadow-popover focus:outline-none data-[state=open]:animate-in"
            aria-label="Command palette"
          >
            <DialogPrimitive.Title className="sr-only">Search and navigate</DialogPrimitive.Title>
            <Command shouldFilter={false} loop>
              <div className="flex items-center gap-2.5 border-b border-border px-4">
                <Search className="size-4 shrink-0 text-fg-subtle" />
                <Command.Input
                  value={query}
                  onValueChange={onQueryChange}
                  placeholder="Search projects, experiments, people…"
                  className="h-12 w-full bg-transparent text-sm text-fg placeholder:text-fg-faint focus:outline-none"
                />
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-fg-subtle sm:inline">ESC</kbd>
              </div>
              <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
                {loading && <div className="px-2 py-3 text-sm text-fg-subtle">Searching…</div>}
                {!loading && query.trim() && results && results.total === 0 && navMatches.length === 0 && (
                  <Command.Empty className="px-2 py-6 text-center text-sm text-fg-muted">No results for “{query}”.</Command.Empty>
                )}

                {navMatches.length > 0 && (
                  <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle">
                    {navMatches.slice(0, 5).map((d) => (
                      <PaletteItem key={d.href} onSelect={() => go(d.href)}>
                        <ArrowRight className="size-4 text-fg-subtle" />
                        <span className="flex-1">{d.label}</span>
                      </PaletteItem>
                    ))}
                  </Command.Group>
                )}

                {results?.groups.map((group) => (
                  <Command.Group
                    key={group.type}
                    heading={group.label}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle"
                  >
                    {group.hits.map((hit) => {
                      const Icon = typeIcon[hit.type];
                      return (
                        <PaletteItem key={`${hit.type}:${hit.id}`} onSelect={() => go(hit.href)}>
                          <Icon className="size-4 shrink-0 text-fg-subtle" />
                          <span className="flex-1 truncate">
                            {hit.title}
                            {hit.subtitle && <span className="ml-2 text-xs text-fg-subtle">{hit.subtitle}</span>}
                          </span>
                          <CornerDownLeft className="size-3.5 text-fg-faint opacity-0 group-aria-selected:opacity-100" />
                        </PaletteItem>
                      );
                    })}
                  </Command.Group>
                ))}

                {query.trim() && (
                  <Command.Group>
                    <PaletteItem onSelect={() => go(routes.search(query.trim()))}>
                      <Search className="size-4 text-fg-subtle" />
                      <span>
                        Search for “<span className="font-medium text-fg">{query.trim()}</span>”
                      </span>
                    </PaletteItem>
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </PaletteContext.Provider>
  );
}

function PaletteItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-fg aria-selected:bg-surface-hover',
      )}
    >
      {children}
    </Command.Item>
  );
}
