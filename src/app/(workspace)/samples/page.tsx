import type { Metadata } from 'next';
import { Microscope } from 'lucide-react';
import { ComingSoon } from '@/components/shell/coming-soon';

export const metadata: Metadata = { title: 'Samples' };

export default function SamplesPage() {
  return (
    <ComingSoon
      icon={<Microscope />}
      title="Samples"
      description="Track samples, aliquots, lineage and storage."
      phase="Phase 3"
      capabilities={['Sample registry with unique IDs', 'Parent/child lineage & aliquots', 'Storage locations & containers', 'Sample metadata & status', 'Usage across experiments', 'Barcode/label printing']}
    />
  );
}
