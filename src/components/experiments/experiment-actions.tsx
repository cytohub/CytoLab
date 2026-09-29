'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, MoreHorizontal, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { StateBadge } from '@/components/domain/status';
import { EXPERIMENT_STATUS_META } from '@/domain/labels';
import type { ExperimentStatus } from '@/domain/enums';
import { api, errorMessage } from '@/lib/api-client';
import { routes } from '@/lib/routes';
import { toast } from '@/components/ui/toast';
import type { ExperimentDetail } from '@/server/modules/experiments/detail';

export function ExperimentStatusButton({ experiment }: { experiment: ExperimentDetail }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);

  const change = async (status: ExperimentStatus, blockedReason?: string) => {
    setPending(true);
    try {
      await api.patch(`/experiments/${experiment.displayId}`, { status, expectedVersion: experiment.version, ...(blockedReason !== undefined ? { blockedReason } : {}) });
      toast.success(`Moved to ${EXPERIMENT_STATUS_META[status].label}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (!experiment.permissions.canEdit) return <StateBadge state={experiment.status} />;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" loading={pending} className="gap-1.5">
            <StateBadge state={experiment.status} dot />
            <ChevronDown className="size-3.5 text-fg-subtle" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {experiment.permissions.allowedTransitions.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => change(status)}>
              <span className={`size-2 rounded-full dot-${EXPERIMENT_STATUS_META[status].tone}`} />
              {EXPERIMENT_STATUS_META[status].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Blocked reason</DialogTitle></DialogHeader>
          <BlockForm onSubmit={(reason) => { void change(experiment.status.value, reason); setBlockOpen(false); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BlockForm({ onSubmit }: { onSubmit: (reason: string) => void }) {
  const [reason, setReason] = React.useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(reason); }} className="space-y-3">
      <Field label="What is blocking this experiment?">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
      </Field>
      <DialogFooter>
        <Button type="submit">Set blocker</Button>
      </DialogFooter>
    </form>
  );
}

export function ExperimentMenu({ experiment }: { experiment: ExperimentDetail }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const del = async () => {
    setPending(true);
    try {
      await api.del(`/experiments/${experiment.displayId}`);
      toast.success('Experiment deleted');
      router.push(routes.experiments);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setPending(false);
      setConfirmOpen(false);
    }
  };

  if (!experiment.permissions.canEdit) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Experiment actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Delete experiment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {experiment.displayId}?</DialogTitle>
            <DialogDescription>This hides the experiment and its records from lists. An admin can restore it.</DialogDescription>
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
