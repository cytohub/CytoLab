import { Skeleton } from '@/components/ui/feedback';
import { PageContainer } from '@/components/ui/page';

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </PageContainer>
  );
}
