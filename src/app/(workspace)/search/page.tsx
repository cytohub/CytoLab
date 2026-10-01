import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical, FolderKanban, Search as SearchIcon, User } from 'lucide-react';
import { searchQuerySchema } from '@/domain/schemas/platform';
import { requireServerAuth } from '@/server/auth/request';
import { search } from '@/server/modules/search/service';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { SearchInput } from '@/components/ui/query-controls';
import { pluralize } from '@/lib/format';

export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

const ICONS = { project: FolderKanban, experiment: FlaskConical, user: User } as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const ctx = await requireServerAuth();
  const { q } = await searchParams;
  const raw = (Array.isArray(q) ? q[0] : q)?.trim() ?? '';
  // Same limits as GET /api/v1/search: the query length drives search cost.
  const parsed = raw ? searchQuerySchema.safeParse({ q: raw, limit: 20 }) : null;
  const query = parsed?.success ? parsed.data.q : raw.slice(0, 80);
  const results = parsed?.success ? await search(ctx, parsed.data) : null;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Search" description="Find projects, experiments and people across your workspace." />
      <div className="mb-6">
        <SearchInput placeholder="Search projects, experiments, people…" />
      </div>

      {!query ? (
        <EmptyState icon={<SearchIcon />} title="Start typing to search" description="Search matches names, identifiers, objectives, and more." />
      ) : parsed && !parsed.success ? (
        <EmptyState icon={<SearchIcon />} title="That search can’t be run" description="Use at most 200 characters, without control characters." />
      ) : !results || results.total === 0 ? (
        <EmptyState icon={<SearchIcon />} title={`No results for “${query}”`} description="Try a different term or check the spelling." />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-fg-subtle">{pluralize(results.total, 'result')} for “{query}”</p>
          {results.groups.map((group) => {
            const Icon = ICONS[group.type];
            return (
              <div key={group.type}>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  <Icon className="size-3.5" /> {group.label}
                </h2>
                <Card>
                  <ul className="divide-y divide-border">
                    {group.hits.map((hit) => (
                      <li key={`${hit.type}:${hit.id}`}>
                        <Link href={hit.href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-hover text-fg-subtle">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-fg group-hover:text-accent">{hit.title}</div>
                            {hit.subtitle && <div className="truncate text-xs text-fg-subtle">{hit.subtitle}</div>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
