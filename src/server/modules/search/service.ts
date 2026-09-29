import 'server-only';
import type { SearchObjectType } from '@/domain/enums';
import type { SearchQuery } from '@/domain/schemas/platform';
import type { AuthContext } from '../../auth/context';
import { searchDocumentsFor, type SearchHit } from '../../platform/search-index';

export interface SearchGroup {
  type: SearchObjectType;
  label: string;
  hits: SearchHit[];
}

export interface SearchResults {
  query: string;
  total: number;
  groups: SearchGroup[];
}

const GROUP_LABELS: Record<SearchObjectType, string> = {
  project: 'Projects',
  experiment: 'Experiments',
  user: 'People',
};
const GROUP_ORDER: SearchObjectType[] = ['project', 'experiment', 'user'];

export async function search(ctx: AuthContext, query: SearchQuery): Promise<SearchResults> {
  const hits = await searchDocumentsFor(ctx, { q: query.q, types: query.types, limitPerType: query.limit });

  const byType = new Map<SearchObjectType, SearchHit[]>();
  for (const hit of hits) {
    const list = byType.get(hit.type) ?? [];
    list.push(hit);
    byType.set(hit.type, list);
  }

  const groups: SearchGroup[] = [];
  for (const type of GROUP_ORDER) {
    const groupHits = byType.get(type);
    if (groupHits?.length) groups.push({ type, label: GROUP_LABELS[type], hits: groupHits });
  }

  return { query: query.q, total: hits.length, groups };
}
