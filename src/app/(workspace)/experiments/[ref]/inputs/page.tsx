import { Boxes } from 'lucide-react';
import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatMeasurement } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InputsPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);

  if (exp.inputs.length === 0) {
    return <EmptyState icon={<Boxes />} title="No inputs recorded" description="Materials, reagents and cell lines used in this experiment will appear here." />;
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR className="hover:bg-transparent"><TH>Material</TH><TH>Type</TH><TH>Identifier</TH><TH>Quantity</TH></TR>
        </THead>
        <TBody>
          {exp.inputs.map((input) => (
            <TR key={input.id}>
              <TD className="font-medium text-fg">{input.name}</TD>
              <TD><Badge tone="neutral" size="sm">{input.inputType.label}</Badge></TD>
              <TD className="font-mono text-xs text-fg-subtle">{input.identifier ?? '—'}</TD>
              <TD className="text-fg-muted">{input.quantity != null ? formatMeasurement(input.quantity, input.unit) : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
