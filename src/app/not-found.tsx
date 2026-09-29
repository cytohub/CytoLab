import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <span className="font-mono text-sm font-medium text-fg-subtle">404</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
      <Button asChild className="mt-6">
        <Link href={routes.dashboard}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
