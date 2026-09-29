import { Skeleton } from '@/components/ui/feedback';
import { PageContainer } from '@/components/ui/page';

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-56" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </PageContainer>
  );
}
