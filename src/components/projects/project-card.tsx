import Link from 'next/link';
import * as React from 'react';
import { ProgressBar } from '@/components/ui/progress';
import { StateBadge, PriorityIndicator, HealthBadge } from '@/components/domain/status';
import { UserCell, ColorLabel, IdTag } from '@/components/domain/misc';
import { formatDate, pluralize } from '@/lib/format';
import type { ProjectListItem } from '@/server/modules/projects/service';

export function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <Link
      href={project.href}
      className="group flex flex-col rounded-lg border border-border bg-surface p-4 shadow-card transition-all hover:border-border-strong hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IdTag>{project.code}</IdTag>
            <PriorityIndicator priority={project.priority} />
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-fg group-hover:text-accent">{project.name}</h3>
        </div>
        <StateBadge state={project.status} size="sm" />
      </div>

      {project.description && <p className="mt-2 line-clamp-2 text-xs text-fg-muted">{project.description}</p>}

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-fg-subtle">
            {project.milestoneProgress.total > 0
              ? `${project.milestoneProgress.completed}/${project.milestoneProgress.total} milestones`
              : pluralize(project.experimentCount, 'experiment')}
          </span>
          <span className="font-medium tabular-nums text-fg-muted">{project.progressPercent}%</span>
        </div>
        <ProgressBar value={project.progressPercent} tone={project.health.tone as 'green' | 'amber' | 'red' | 'muted'} size="sm" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <UserCell user={project.owner} size="xs" muted />
        <div className="flex min-w-0 items-center gap-2">
          {project.researchArea && <ColorLabel color={project.researchArea.color} className="hidden text-xs sm:inline-flex">{project.researchArea.name}</ColorLabel>}
          <span className="shrink-0">
            <HealthBadge health={project.health} size="sm" />
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-fg-faint">
        <span>{project.needsAttentionCount > 0 ? `${project.needsAttentionCount} need attention` : `${project.openExperimentCount} open`}</span>
        {project.targetDate && <span>Due {formatDate(project.targetDate)}</span>}
      </div>
    </Link>
  );
}
