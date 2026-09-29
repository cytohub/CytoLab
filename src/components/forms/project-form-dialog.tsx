'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineError } from '@/components/ui/feedback';
import { PRIORITIES, PROJECT_STATUSES } from '@/domain/enums';
import { PRIORITY_META, PROJECT_STATUS_META } from '@/domain/labels';
import { suggestProjectCode } from '@/domain/identifiers';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { useFormOptions } from '@/lib/use-options';
import { toast } from '@/components/ui/toast';
import type { ProjectDetail } from '@/server/modules/projects/service';

interface FormState {
  name: string;
  code: string;
  description: string;
  ownerId: string;
  teamId: string;
  researchAreaId: string;
  status: string;
  priority: string;
  startDate: string;
  targetDate: string;
}

function fromProject(project?: ProjectDetail): FormState {
  return {
    name: project?.name ?? '',
    code: project?.code ?? '',
    description: project?.description ?? '',
    ownerId: project?.owner?.id ?? '',
    teamId: project?.team?.id ?? '',
    researchAreaId: project?.researchArea?.id ?? '',
    status: project?.status.value ?? 'planning',
    priority: project?.priority.value ?? 'medium',
    startDate: project?.startDate ?? '',
    targetDate: project?.targetDate ?? '',
  };
}

function ProjectForm({ project, onDone, onCancel }: { project?: ProjectDetail; onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const { options } = useFormOptions(true);
  const [form, setForm] = React.useState<FormState>(() => fromProject(project));
  const [codeEdited, setCodeEdited] = React.useState(Boolean(project));
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const isEdit = Boolean(project);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const ownerId = form.ownerId || options?.members[0]?.id || '';

  const submit = async () => {
    setErrors({});
    setFormError(null);
    setPending(true);
    const body = {
      name: form.name,
      code: form.code,
      description: form.description || null,
      ownerId,
      teamId: form.teamId || null,
      researchAreaId: form.researchAreaId || null,
      status: form.status,
      priority: form.priority,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      ...(isEdit ? { expectedVersion: project!.version } : {}),
    };
    try {
      const { data } = isEdit
        ? await api.patch<ProjectDetail>(`/projects/${project!.code}`, body)
        : await api.post<ProjectDetail>('/projects', body);
      toast.success(isEdit ? 'Project updated' : `Project ${data.code} created`);
      onDone();
      if (!isEdit) router.push(data.href);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'validation_error') setErrors(err.fieldErrors);
      else setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
      {formError && <InlineError>{formError}</InlineError>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="p-name" required error={errors.name?.[0]} className="sm:col-span-2">
          <Input id="p-name" value={form.name} onChange={(e) => { set('name', e.target.value); if (!codeEdited) set('code', suggestProjectCode(e.target.value)); }} placeholder="CAR-T Cell Engineering" autoFocus required />
        </Field>
        <Field label="Code" htmlFor="p-code" required error={errors.code?.[0]} hint="e.g. CART-001">
          <Input id="p-code" value={form.code} onChange={(e) => { set('code', e.target.value.toUpperCase()); setCodeEdited(true); }} className="font-mono" required />
        </Field>
      </div>
      <Field label="Description" htmlFor="p-desc" error={errors.description?.[0]}>
        <Textarea id="p-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this project about?" rows={3} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Owner" required error={errors.ownerId?.[0]}>
          <Select value={ownerId} onValueChange={(v) => set('ownerId', v)}>
            <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
            <SelectContent>{options?.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Team" error={errors.teamId?.[0]}>
          <Select value={form.teamId || 'none'} onValueChange={(v) => set('teamId', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
            <SelectContent><SelectItem value="none">No team</SelectItem>{options?.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Research area" error={errors.researchAreaId?.[0]}>
          <Select value={form.researchAreaId || 'none'} onValueChange={(v) => set('researchAreaId', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem>{options?.researchAreas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_META[s].label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Start date" error={errors.startDate?.[0]}>
          <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Target date" error={errors.targetDate?.[0]}>
          <Input type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={pending}>{isEdit ? 'Save changes' : 'Create project'}</Button>
      </DialogFooter>
    </form>
  );
}

export function CreateProjectDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Projects group experiments, milestones and research objectives.</DialogDescription>
        </DialogHeader>
        {open && <ProjectForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function EditProjectDialog({ project, open, onOpenChange }: { project: ProjectDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit {project.code}</DialogTitle>
        </DialogHeader>
        {open && <ProjectForm project={project} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
