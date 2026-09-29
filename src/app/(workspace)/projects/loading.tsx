import { Skeleton } from '@/components/ui/feedback';
import { PageContainer } from '@/components/ui/page';

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <Skeleton className="mt-5 h-9 w-full max-w-xs" />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
      </div>
    </PageContainer>
  );
}
