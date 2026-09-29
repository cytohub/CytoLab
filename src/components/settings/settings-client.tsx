'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { COLOR_TOKENS } from '@/domain/schemas/common';
import { api, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/components/shell/session-context';
import type { ExperimentTypeView } from '@/server/modules/config/service';
import type { TagSummary } from '@/server/modules/shared/presenters';

export function ProfileSettings() {
  const router = useRouter();
  const { user } = useSession();
  const [name, setName] = React.useState(user.name);
  const [title, setTitle] = React.useState(user.title ?? '');
  const [color, setColor] = React.useState(user.avatarColor);
  const [pending, setPending] = React.useState(false);
  const dirty = name !== user.name || title !== (user.title ?? '') || color !== user.avatarColor;

  const save = async () => {
    setPending(true);
    try {
      await api.patch('/me', { name, title: title || null, avatarColor: color });
      toast.success('Profile updated');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={name} color={color} size="xl" />
          <div className="flex flex-wrap gap-1.5">
            {COLOR_TOKENS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cn(`size-6 rounded-full avatar-${c} ring-2 ring-offset-2 ring-offset-surface`, color === c ? 'ring-accent' : 'ring-transparent')} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="s-name"><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Title" htmlFor="s-title"><Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Scientist" /></Field>
        </div>
        <Field label="Email"><Input value={user.email} disabled /></Field>
        <div className="flex justify-end">
          <Button onClick={save} loading={pending} disabled={!dirty}>Save changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExperimentTypesSettings({ types, canManage }: { types: ExperimentTypeView[]; canManage: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Experiment types</CardTitle>
        {canManage && <AddTypeDialog />}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <span key={t.id} className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs', `chip-${t.color}`)}>
              {t.name}
              <span className="opacity-60">{t.experimentCount}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AddTypeDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [color, setColor] = React.useState('blue');
  const [pending, setPending] = React.useState(false);
  const submit = async () => {
    setPending(true);
    try {
      await api.post('/experiment-types', { name, category, color });
      toast.success('Type added');
      setOpen(false); setName(''); setCategory(''); router.refresh();
    } catch (err) { toast.error(errorMessage(err)); } finally { setPending(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus /> Add type</Button></DialogTrigger>
      <DialogContent size="md">
        <DialogHeader><DialogTitle>Add experiment type</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required /></Field>
          <Field label="Category" required><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Cell-based assay" required /></Field>
          <Field label="Color">
            <NativeSelect value={color} onChange={(e) => setColor(e.target.value)}>
              {COLOR_TOKENS.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </Field>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Add type</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TagsSettings({ tags, canManage }: { tags: TagSummary[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setPending(true);
    try { await api.post('/tags', { name }); setName(''); router.refresh(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setPending(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => <Badge key={t.id} tone="neutral" className={`chip-${t.color}`}>{t.name}</Badge>)}
          {tags.length === 0 && <span className="text-sm text-fg-faint">No tags yet.</span>}
        </div>
        {canManage && (
          <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New tag name" className="max-w-xs" />
            <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={!name.trim()}><Plus /> Add</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
