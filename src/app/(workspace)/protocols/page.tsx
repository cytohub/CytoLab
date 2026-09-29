import type { Metadata } from 'next';
import { ClipboardList } from 'lucide-react';
import { ComingSoon } from '@/components/shell/coming-soon';

export const metadata: Metadata = { title: 'Protocols' };

export default function ProtocolsPage() {
  return (
    <ComingSoon
      icon={<ClipboardList />}
      title="Protocols"
      description="A versioned library of standard operating procedures."
      phase="Phase 2"
      capabilities={['Protocol library & templates', 'Version history & ownership', 'Step-by-step procedures', 'Protocol execution from experiments', 'Attachments & references', 'Usage analytics']}
    />
  );
}
