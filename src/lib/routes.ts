import type { EntityType, SearchObjectType } from '@/domain/enums';

/** Canonical in-app URLs. Human-readable IDs are used wherever they exist. */
export const routes = {
  home: '/dashboard',
  login: '/login',
  dashboard: '/dashboard',
  projects: '/projects',
  project: (ref: string, tab?: string) => `/projects/${encodeURIComponent(ref)}${tab ? `/${tab}` : ''}`,
  experiments: '/experiments',
  experiment: (ref: string, tab?: string) => `/experiments/${encodeURIComponent(ref)}${tab ? `/${tab}` : ''}`,
  timeline: '/timeline',
  progress: '/progress',
  activity: '/activity',
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : '/search'),
  notifications: '/notifications',
  teams: '/teams',
  team: (id: string) => `/teams/${id}`,
  member: (id: string) => `/teams/members/${id}`,
  settings: '/settings',
  samples: '/samples',
  sample: (ref: string) => `/samples/${encodeURIComponent(ref)}`,
  protocols: '/protocols',
  data: '/data',
  inventory: '/inventory',
} as const;

export function entityHref(type: EntityType | SearchObjectType, ref: string): string {
  switch (type) {
    case 'project':
      return routes.project(ref);
    case 'experiment':
      return routes.experiment(ref);
    case 'sample':
      return routes.sample(ref);
    case 'user':
      return routes.member(ref);
  }
}
