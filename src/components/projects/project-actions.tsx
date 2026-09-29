'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StateBadge } from '@/components/domain/status';
import { PROJECT_STATUS_META } from '@/domain/labels';
import { PROJECT_TRANSITIONS } from '@/domain/workflows';
import type { ProjectStatus } from '@/domain/enums';
import { api, errorMessage } from '@/lib/api-client';
import { routes } from '@/lib/routes';
import { toast } from '@/components/ui/toast';
import type { ProjectDetail } from '@/server/modules/projects/service';

export function ProjectStatusButton({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const transitions = PROJECT_TRANSITIONS[project.status.value];

  const changeStatus = async (status: ProjectStatus) => {
    setPending(true);
    try {
      await api.patch(`/projects/${project.code}`, { status, expectedVersion: project.version });
      toast.success(`Moved to ${PROJECT_STATUS_META[status].label}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (!project.permissions.canEdit) return <StateBadge state={project.status} />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" loading={pending} className="gap-1.5">
          <StateBadge state={project.status} dot />
          <ChevronDown className="size-3.5 text-fg-subtle" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        {transitions.map((status) => (
          <DropdownMenuItem key={status} onSelect={() => changeStatus(status)}>
            <span className={`size-2 rounded-full dot-${PROJECT_STATUS_META[status].tone}`} />
            {PROJECT_STATUS_META[status].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectMenu({ project, onEdit }: { project: ProjectDetail; onEdit: () => void }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const del = async () => {
    setPending(true);
    try {
      await api.del(`/projects/${project.code}`);
      toast.success('Project deleted');
      router.push(routes.projects);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setPending(false);
      setConfirmOpen(false);
    }
  };

  if (!project.permissions.canEdit && !project.permissions.canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Project actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {project.permissions.canEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit project
            </DropdownMenuItem>
          )}
          {project.permissions.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
                <Trash2 /> Delete project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {project.code}?</DialogTitle>
            <DialogDescription>
              This archives the project and hides it from lists. Open experiments must be resolved first. This can be undone by an admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
