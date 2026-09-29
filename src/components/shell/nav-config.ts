import {
  Activity,
  Boxes,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LineChart,
  Microscope,
  Package,
  ClipboardList,
  Users,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import { routes } from '@/lib/routes';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  comingSoon?: boolean;
  /** Match these path prefixes as active in addition to href. */
  match?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: routes.dashboard, icon: LayoutDashboard, exact: true },
      { label: 'Projects', href: routes.projects, icon: FolderKanban },
      { label: 'Experiments', href: routes.experiments, icon: FlaskConical },
      { label: 'Timeline', href: routes.timeline, icon: CalendarRange },
      { label: 'Progress', href: routes.progress, icon: LineChart },
      { label: 'Activity', href: routes.activity, icon: Activity },
    ],
  },
  {
    label: 'Lab modules',
    items: [
      { label: 'Samples', href: routes.samples, icon: Microscope, comingSoon: true },
      { label: 'Protocols', href: routes.protocols, icon: ClipboardList, comingSoon: true },
      { label: 'Data', href: routes.data, icon: Boxes, comingSoon: true },
      { label: 'Inventory', href: routes.inventory, icon: Package, comingSoon: true },
    ],
  },
  {
    label: 'Organization',
    items: [{ label: 'Teams', href: routes.teams, icon: Users }],
  },
];

/** Flat list of navigable (non-coming-soon) destinations for the command palette. */
export const NAV_DESTINATIONS = NAV_GROUPS.flatMap((g) => g.items)
  .filter((i) => !i.comingSoon)
  .concat([{ label: 'Search', href: routes.search(), icon: LayoutDashboard }, { label: 'Settings', href: routes.settings, icon: LayoutDashboard }]);
