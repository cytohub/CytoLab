'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineError } from '@/components/ui/feedback';
import { PRIORITIES } from '@/domain/enums';
import { PRIORITY_META } from '@/domain/labels';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { routes } from '@/lib/routes';
import { useFormOptions } from '@/lib/use-options';
import { useSession } from '@/components/shell/session-context';
import { toast } from '@/components/ui/toast';
import type { ExperimentDetail } from '@/server/modules/experiments/detail';

export function CreateExperimentDialog({ trigger, defaultProjectId }: { trigger: React.ReactNode; defaultProjectId?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New experiment</DialogTitle>
          <DialogDescription>Design an experiment under a project. You can add protocol, samples and results later.</DialogDescription>
        </DialogHeader>
        {open && <ExperimentForm defaultProjectId={defaultProjectId} onDone={() => setOpen(false)} router={router} />}
      </DialogContent>
    </Dialog>
  );
}

function ExperimentForm({ defaultProjectId, onDone, router }: { defaultProjectId?: string; onDone: () => void; router: ReturnType<typeof useRouter> }) {
  const { options } = useFormOptions(true);
  const session = useSession();
  const [projectId, setProjectId] = React.useState(defaultProjectId ?? '');
  const [projects, setProjects] = React.useState<Array<{ id: string; code: string; name: string }>>([]);
  const [experimentTypeId, setTypeId] = React.useState('');
  const [name, setName] = React.useState('');
  const [objective, setObjective] = React.useState('');
  const [hypothesis, setHypothesis] = React.useState('');
  const [researcherId, setResearcherId] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [startDate] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Projects list for the picker (separate from form options). A ref guard keeps
  // the fetch to once without a synchronous setState in the effect body.
  const loadedRef = React.useRef(false);
  React.useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    api
      .get<Array<{ id: string; code: string; name: string }>>('/projects', { pageSize: 100, sort: 'name' })
      .then((r) => setProjects(r.data))
      .catch(() => {});
  }, []);

  const type = experimentTypeId || options?.experimentTypes[0]?.id || '';
  // Whoever designs the experiment is the most likely researcher.
  const me = options?.members.find((m) => m.id === session.user.id);
  const researcher = researcherId || me?.id || options?.members[0]?.id || '';

  const submit = async () => {
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      const { data } = await api.post<ExperimentDetail>('/experiments', {
        projectId,
        experimentTypeId: type,
        name,
        objective: objective || null,
        hypothesis: hypothesis || null,
        researcherId: researcher,
        priority,
        startDate: startDate || null,
        targetDate: targetDate || null,
        tagIds: [],
      });
      toast.success(`Experiment ${data.displayId} created`);
      onDone();
      router.push(routes.experiment(data.displayId));
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
      <Field label="Name" htmlFor="e-name" required error={errors.name?.[0]}>
        <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lentiviral transduction — MOI titration" autoFocus required />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project" required error={errors.projectId?.[0]}>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Type" required error={errors.experimentTypeId?.[0]}>
          <Select value={type} onValueChange={setTypeId}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{options?.experimentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Objective" htmlFor="e-obj" error={errors.objective?.[0]}>
        <Textarea id="e-obj" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What question does this experiment answer?" rows={2} />
      </Field>
      <Field label="Hypothesis" htmlFor="e-hyp" error={errors.hypothesis?.[0]}>
        <Textarea id="e-hyp" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Expected outcome" rows={2} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Researcher" required error={errors.researcherId?.[0]}>
          <Select value={researcher} onValueChange={setResearcherId}>
            <SelectTrigger><SelectValue placeholder="Assign" /></SelectTrigger>
            <SelectContent>{options?.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Target date" error={errors.targetDate?.[0]}>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>Create experiment</Button>
      </DialogFooter>
    </form>
  );
}
