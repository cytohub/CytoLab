'use client';

import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/feedback';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { toast } from '@/components/ui/toast';
import type { MilestoneView } from '@/server/modules/projects/service';

export function MilestoneManager({ projectCode, milestones, canManage }: { projectCode: string; milestones: MilestoneView[]; canManage: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const toggle = async (m: MilestoneView) => {
    setBusyId(m.id);
    const next = m.status.value === 'completed' ? 'pending' : 'completed';
    try {
      await api.patch(`/milestones/${m.id}`, { status: next });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: MilestoneView) => {
    setBusyId(m.id);
    try {
      await api.del(`/milestones/${m.id}`);
      toast.success('Milestone removed');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <AddMilestoneDialog projectCode={projectCode} />
        </div>
      )}

      {milestones.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title="No milestones"
          description="Break this project into milestones to track progress."
          action={canManage ? <AddMilestoneDialog projectCode={projectCode} /> : undefined}
        />
      ) : (
        <Card>
          <ol className="divide-y divide-border">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  onClick={() => canManage && toggle(m)}
                  disabled={!canManage || busyId === m.id}
                  className={cn('mt-0.5 shrink-0 rounded-full transition-transform', canManage && 'hover:scale-110', !canManage && 'cursor-default')}
                  aria-label={m.status.value === 'completed' ? 'Mark incomplete' : 'Mark complete'}
                >
                  {m.status.value === 'completed' ? (
                    <CheckCircle2 className="size-5 text-[var(--tone-green-fg)]" />
                  ) : (
                    <Circle className={cn('size-5', m.overdue ? 'text-[var(--tone-red-fg)]' : m.status.value === 'in_progress' ? 'text-[var(--tone-blue-fg)]' : 'text-fg-faint')} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle">{m.displayId}</span>
                    <span className={cn('text-sm font-medium', m.status.value === 'completed' ? 'text-fg-muted line-through' : 'text-fg')}>{m.title}</span>
                  </div>
                  {m.description && <p className="mt-1 text-sm text-fg-muted">{m.description}</p>}
                  <div className="mt-1 flex items-center gap-2 text-xs text-fg-subtle">
                    <span className={m.overdue ? 'text-[var(--tone-red-fg)]' : undefined}>
                      {m.status.value === 'completed' && m.completedAt ? `Reached ${formatDate(m.completedAt.slice(0, 10))}` : m.dueDate ? `Due ${formatDate(m.dueDate)}` : 'No due date'}
                    </span>
                    {m.owner && <span>· {m.owner.name}</span>}
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => remove(m)} disabled={busyId === m.id} className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-[var(--tone-red-bg)] hover:text-[var(--tone-red-fg)]" aria-label="Delete milestone">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function AddMilestoneDialog({ projectCode }: { projectCode: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    setErrors({});
    setPending(true);
    try {
      await api.post(`/projects/${projectCode}/milestones`, { title, description: description || null, dueDate: dueDate || null });
      toast.success('Milestone added');
      setOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'validation_error') setErrors(err.fieldErrors);
      else toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus /> Add milestone
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add milestone</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <Field label="Title" htmlFor="m-title" required error={errors.title?.[0]}>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="In vitro potency established" autoFocus required />
          </Field>
          <Field label="Description" htmlFor="m-desc" error={errors.description?.[0]}>
            <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="Due date" htmlFor="m-due" error={errors.dueDate?.[0]}>
            <Input id="m-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}><Check /> Add milestone</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
