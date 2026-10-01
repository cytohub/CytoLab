'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Download, FileText, Paperclip, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Textarea, NativeSelect } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/feedback';
import { OBSERVATION_SIGNIFICANCE } from '@/domain/enums';
import { OBSERVATION_SIGNIFICANCE_META } from '@/domain/labels';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMeasurement } from '@/lib/format';
import { toast } from '@/components/ui/toast';
import { Avatar } from '@/components/ui/avatar';
import type { ObservationView, ResultView, StepView } from '@/server/modules/experiments/detail';
import type { AttachmentView } from '@/server/modules/collaboration/attachments';

function useRefresh() {
  const router = useRouter();
  return React.useCallback(() => router.refresh(), [router]);
}

// --- Protocol steps --------------------------------------------------------

export function ProtocolSteps({ displayId, steps, canEdit }: { displayId: string; steps: StepView[]; canEdit: boolean }) {
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState<string | null>(null);
  const done = steps.filter((s) => s.completed).length;

  const toggle = async (step: StepView) => {
    setBusy(step.id);
    try {
      await api.patch(`/experiments/${displayId}/steps/${step.id}`, { completed: !step.completed });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (step: StepView) => {
    setBusy(step.id);
    try {
      await api.del(`/experiments/${displayId}/steps/${step.id}`);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">{steps.length > 0 ? `${done} of ${steps.length} steps complete` : 'Protocol steps'}</span>
        {canEdit && <AddStepDialog displayId={displayId} />}
      </div>
      {steps.length === 0 ? (
        <EmptyState icon={<FileText />} title="No protocol steps" description="Add the step-by-step procedure for this experiment." action={canEdit ? <AddStepDialog displayId={displayId} /> : undefined} />
      ) : (
        <Card>
          <ol className="divide-y divide-border">
            {steps.map((step, i) => (
              <li key={step.id} className="flex items-start gap-3 px-4 py-3">
                <button onClick={() => canEdit && toggle(step)} disabled={!canEdit || busy === step.id} className={cn('mt-0.5 shrink-0', canEdit && 'hover:scale-110')} aria-label={step.completed ? 'Mark incomplete' : 'Mark complete'}>
                  {step.completed ? <CheckCircle2 className="size-5 text-[var(--tone-green-fg)]" /> : <Circle className="size-5 text-fg-faint" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-fg-subtle">{i + 1}.</span>
                    <span className={cn('text-sm font-medium', step.completed ? 'text-fg-muted' : 'text-fg')}>{step.title}</span>
                    {step.durationMinutes != null && <span className="text-xs text-fg-subtle">~{formatDuration(step.durationMinutes)}</span>}
                  </div>
                  {step.details && <p className="mt-1 text-sm text-fg-muted">{step.details}</p>}
                  {step.completed && step.completedBy && <p className="mt-1 text-xs text-fg-faint">Done by {step.completedBy.name}</p>}
                </div>
                {canEdit && (
                  <button onClick={() => remove(step)} disabled={busy === step.id} className="rounded-md p-1 text-fg-subtle hover:bg-[var(--tone-red-bg)] hover:text-[var(--tone-red-fg)]" aria-label="Delete step">
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

function AddStepDialog({ displayId }: { displayId: string }) {
  const refresh = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const submit = async () => {
    setPending(true);
    try {
      await api.post(`/experiments/${displayId}/steps`, { title, details: details || null });
      setOpen(false); setTitle(''); setDetails(''); refresh();
    } catch (err) { toast.error(errorMessage(err)); } finally { setPending(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus /> Add step</Button></DialogTrigger>
      <DialogContent size="md">
        <DialogHeader><DialogTitle>Add protocol step</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <Field label="Step" required><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activate T cells with CD3/CD28 beads" autoFocus required /></Field>
          <Field label="Details"><Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} /></Field>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Add step</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Observations ----------------------------------------------------------

export function ObservationLog({ displayId, observations, canEdit }: { displayId: string; observations: ObservationView[]; canEdit: boolean }) {
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState<string | null>(null);
  const remove = async (id: string) => {
    setBusy(id);
    try { await api.del(`/experiments/${displayId}/observations/${id}`); refresh(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><AddObservationDialog displayId={displayId} /></div>}
      {observations.length === 0 ? (
        <EmptyState icon={<FileText />} title="No observations" description="Log timestamped observations as the experiment progresses." action={canEdit ? <AddObservationDialog displayId={displayId} /> : undefined} />
      ) : (
        <div className="space-y-3">
          {observations.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-start gap-3">
                {o.author && <Avatar name={o.author.name} initials={o.author.initials} color={o.author.avatarColor} avatarUrl={o.author.avatarUrl} size="sm" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg">{o.author?.name ?? 'Unknown'}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', `tone-${o.significance.tone}`)}>{o.significance.label}</span>
                    <span className="text-xs text-fg-faint">{formatDateTime(o.observedAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{o.body}</p>
                </div>
                {o.canModify && (
                  <button onClick={() => remove(o.id)} disabled={busy === o.id} className="rounded-md p-1 text-fg-subtle hover:bg-[var(--tone-red-bg)] hover:text-[var(--tone-red-fg)]" aria-label="Delete observation">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddObservationDialog({ displayId }: { displayId: string }) {
  const refresh = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState('');
  const [significance, setSignificance] = React.useState('routine');
  const [pending, setPending] = React.useState(false);
  const submit = async () => {
    setPending(true);
    try { await api.post(`/experiments/${displayId}/observations`, { body, significance }); setOpen(false); setBody(''); setSignificance('routine'); refresh(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setPending(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus /> Add observation</Button></DialogTrigger>
      <DialogContent size="md">
        <DialogHeader><DialogTitle>Record observation</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <Field label="Observation" required><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} autoFocus required placeholder="What did you observe?" /></Field>
          <Field label="Significance">
            <NativeSelect value={significance} onChange={(e) => setSignificance(e.target.value)}>
              {OBSERVATION_SIGNIFICANCE.map((s) => <option key={s} value={s}>{OBSERVATION_SIGNIFICANCE_META[s].label}</option>)}
            </NativeSelect>
          </Field>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Record</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Results ---------------------------------------------------------------

export function ResultsManager({ displayId, results, canEdit }: { displayId: string; results: ResultView[]; canEdit: boolean }) {
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState<string | null>(null);
  const remove = async (id: string) => {
    setBusy(id);
    try { await api.del(`/experiments/${displayId}/results/${id}`); refresh(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><AddResultDialog displayId={displayId} /></div>}
      {results.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="No results" description="Record structured measurements and outcomes." action={canEdit ? <AddResultDialog displayId={displayId} /> : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <Card key={r.id} className={cn('p-4', r.isKey && 'border-[color:var(--tone-violet-fg)]/30')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {r.isKey && <Sparkles className="size-3.5 text-[var(--tone-violet-fg)]" />}
                    <span className="truncate text-xs text-fg-subtle">{r.name}</span>
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-fg">{formatMeasurement(r.valueNumeric, r.unit, r.valueText)}</div>
                  {r.sample && <div className="mt-0.5 text-xs text-fg-faint">from {r.sample.displayId}</div>}
                </div>
                {r.canModify && (
                  <button onClick={() => remove(r.id)} disabled={busy === r.id} className="rounded-md p-1 text-fg-subtle hover:bg-[var(--tone-red-bg)] hover:text-[var(--tone-red-fg)]" aria-label="Delete result">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddResultDialog({ displayId }: { displayId: string }) {
  const refresh = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [isKey, setIsKey] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);
  const submit = async () => {
    setErrors({}); setPending(true);
    const numeric = value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : null;
    try {
      await api.post(`/experiments/${displayId}/results`, { name, valueNumeric: numeric, valueText: numeric === null ? value : null, unit: unit || null, isKey });
      setOpen(false); setName(''); setValue(''); setUnit(''); setIsKey(false); refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'validation_error') setErrors(err.fieldErrors);
      else toast.error(errorMessage(err));
    } finally { setPending(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus /> Add result</Button></DialogTrigger>
      <DialogContent size="md">
        <DialogHeader><DialogTitle>Record result</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <Field label="Measurement" required error={errors.name?.[0]}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CAR+ T cells at MOI 5" autoFocus required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Value" required error={errors.valueNumeric?.[0]}><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="48.2" required /></Field>
            <Field label="Unit"><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isKey} onChange={(e) => setIsKey(e.target.checked)} className="size-4 rounded border-border accent-[var(--accent)]" />
            Mark as a key result
          </label>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Add result</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Files -----------------------------------------------------------------

export function FileManager({
  entityId,
  attachments,
  canEdit,
  lockedReason = null,
}: {
  entityId: string;
  attachments: AttachmentView[];
  canEdit: boolean;
  /** Set when uploads are turned off for this deployment; shown instead of the upload control. */
  lockedReason?: string | null;
}) {
  const refresh = useRefresh();
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.upload(`/entities/${entityId}/attachments`, form);
      toast.success('File uploaded');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const remove = async (id: string) => {
    setBusy(id);
    try { await api.del(`/attachments/${id}`); refresh(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {canEdit && !lockedReason && (
        <div className="flex justify-end">
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          <Button size="sm" variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}><Upload /> Upload file</Button>
        </div>
      )}
      {lockedReason && attachments.length > 0 && <p className="text-right text-xs text-fg-subtle">{lockedReason}</p>}
      {attachments.length === 0 ? (
        <EmptyState icon={<Paperclip />} title="No files" description={lockedReason ?? 'Attach raw data, images, gating strategies and reports.'} />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-hover text-fg-subtle"><FileText className="size-4.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{a.fileName}</div>
                  <div className="text-xs text-fg-subtle">{formatBytes(a.sizeBytes)} · {a.uploadedBy?.name ?? 'Unknown'} · {formatDateTime(a.createdAt)}</div>
                </div>
                <a href={a.downloadHref} className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg" aria-label="Download" download>
                  <Download className="size-4" />
                </a>
                {a.canDelete && !lockedReason && (
                  <button onClick={() => remove(a.id)} disabled={busy === a.id} className="rounded-md p-1.5 text-fg-subtle hover:bg-[var(--tone-red-bg)] hover:text-[var(--tone-red-fg)]" aria-label="Delete file">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)} h`;
  return `${Math.round(minutes / 1440)} d`;
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

