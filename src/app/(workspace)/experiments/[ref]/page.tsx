import type { Metadata } from 'next';
import { Beaker, Sparkles, Target } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatMeasurement } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: `${ref.toUpperCase()} · Experiment` };
}

export default async function ExperimentOverviewPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);
  const keyResults = exp.results.filter((r) => r.isKey);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Target className="size-4 text-fg-subtle" /> Objective</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-fg-muted">{exp.objective || <span className="text-fg-faint">No objective recorded.</span>}</p>
            {exp.hypothesis && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-1 text-xs font-medium text-fg-subtle">Hypothesis</div>
                <p className="text-sm leading-relaxed text-fg-muted">{exp.hypothesis}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {exp.conditions.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Beaker className="size-4 text-fg-subtle" /> Conditions</CardTitle></CardHeader>
            <Table>
              <THead>
                <TR className="hover:bg-transparent"><TH>Parameter</TH><TH>Value</TH><TH>Unit</TH></TR>
              </THead>
              <TBody>
                {exp.conditions.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium text-fg">{c.name}</TD>
                    <TD className="text-fg-muted">{c.value}</TD>
                    <TD className="text-fg-subtle">{c.unit ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}

        {(exp.resultsSummary || exp.conclusion) && (
          <Card>
            <CardHeader><CardTitle>Summary &amp; conclusion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {exp.resultsSummary && (
                <div>
                  <div className="mb-1 text-xs font-medium text-fg-subtle">Results summary</div>
                  <p className="text-sm leading-relaxed text-fg-muted">{exp.resultsSummary}</p>
                </div>
              )}
              {exp.conclusion && (
                <div className={exp.resultsSummary ? 'border-t border-border pt-4' : ''}>
                  <div className="mb-1 text-xs font-medium text-fg-subtle">Conclusion</div>
                  <p className="text-sm leading-relaxed text-fg-muted">{exp.conclusion}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Sparkles className="size-4 text-[var(--tone-violet-fg)]" /> Key results</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {keyResults.length === 0 ? (
              <p className="py-4 text-center text-sm text-fg-muted">No key results yet.</p>
            ) : (
              <ul className="space-y-3">
                {keyResults.map((r) => (
                  <li key={r.id}>
                    <div className="text-xs text-fg-subtle">{r.name}</div>
                    <div className="text-lg font-semibold tabular-nums text-fg">{formatMeasurement(r.valueNumeric, r.unit, r.valueText)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>At a glance</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Protocol steps" value={`${exp.counts.stepsCompleted}/${exp.counts.steps}`} />
            <Stat label="Observations" value={exp.counts.observations} />
            <Stat label="Results" value={exp.counts.results} />
            <Stat label="Samples" value={exp.counts.samples} />
            <Stat label="Inputs" value={exp.counts.inputs} />
            <Stat label="Conditions" value={exp.counts.conditions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-hover px-2.5 py-2">
      <div className="text-lg font-semibold tabular-nums text-fg">{value}</div>
      <div className="text-xs text-fg-subtle">{label}</div>
    </div>
  );
}
