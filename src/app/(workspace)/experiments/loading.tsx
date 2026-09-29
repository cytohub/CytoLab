import { Skeleton } from '@/components/ui/feedback';
import { PageContainer } from '@/components/ui/page';

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-56" />
      <Skeleton className="mt-5 h-9 w-full max-w-xs" />
      <Skeleton className="mt-5 h-96 w-full" />
    </PageContainer>
  );
}
