import { Microscope } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StateBadge } from '@/components/domain/status';
import { IdTag } from '@/components/domain/misc';
import { formatMeasurement } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SamplesPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);

  if (exp.samples.length === 0) {
    return <EmptyState icon={<Microscope />} title="No samples linked" description="Input and output samples for this experiment will appear here. Full sample management is coming soon." />;
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR className="hover:bg-transparent"><TH>Sample</TH><TH>Type</TH><TH>Role</TH><TH>Status</TH><TH>Quantity</TH><TH className="hidden md:table-cell">Location</TH></TR>
        </THead>
        <TBody>
          {exp.samples.map((s) => (
            <TR key={`${s.id}-${s.role}`}>
              <TD>
                <span className="flex items-center gap-2">
                  <IdTag>{s.displayId}</IdTag>
                  <span className="font-medium text-fg">{s.name}</span>
                </span>
              </TD>
              <TD className="text-fg-muted">{s.sampleType}</TD>
              <TD><Badge tone={s.role === 'output' ? 'green' : 'blue'} size="sm">{s.role}</Badge></TD>
              <TD><StateBadge state={s.status} size="sm" /></TD>
              <TD className="text-fg-muted">{s.quantity != null ? formatMeasurement(s.quantity, s.unit) : '—'}</TD>
              <TD className="hidden text-xs text-fg-subtle md:table-cell">{s.storageLocation ?? '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
