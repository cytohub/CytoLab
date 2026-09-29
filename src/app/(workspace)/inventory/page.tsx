import type { Metadata } from 'next';
import { Package } from 'lucide-react';
import { ComingSoon } from '@/components/shell/coming-soon';

export const metadata: Metadata = { title: 'Inventory' };

export default function InventoryPage() {
  return (
    <ComingSoon
      icon={<Package />}
      title="Inventory"
      description="Reagents, consumables and equipment."
      phase="Phase 3"
      capabilities={['Reagent & consumable tracking', 'Lot & expiry management', 'Stock levels & reorder alerts', 'Instrument registry', 'Consumption from experiments', 'Cost tracking']}
    />
  );
}
