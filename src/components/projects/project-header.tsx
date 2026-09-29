'use client';

import * as React from 'react';
import { ProjectMenu, ProjectStatusButton } from './project-actions';
import { EditProjectDialog } from '@/components/forms/project-form-dialog';
import type { ProjectDetail } from '@/server/modules/projects/service';

export function ProjectHeaderActions({ project }: { project: ProjectDetail }) {
  const [editOpen, setEditOpen] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      <ProjectStatusButton project={project} />
      <ProjectMenu project={project} onEdit={() => setEditOpen(true)} />
      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
