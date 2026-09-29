import type { Metadata } from 'next';
import { Boxes } from 'lucide-react';
import { ComingSoon } from '@/components/shell/coming-soon';

export const metadata: Metadata = { title: 'Data' };

export default function DataPage() {
  return (
    <ComingSoon
      icon={<Boxes />}
      title="Data"
      description="Structured datasets, measurements and results."
      phase="Phase 3"
      capabilities={['Experimental datasets', 'Structured measurements & results', 'Data files & metadata', 'Instrument file parsing', 'Data lineage', 'Interactive visualizations']}
    />
  );
}
