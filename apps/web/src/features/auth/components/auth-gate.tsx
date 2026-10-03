'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { isUnauthorized } from '@/lib/api-client';
import { useMe } from '../hooks';

/**
 * Renders children only for a signed-in user. If the session is gone (expired or revoked),
 * sends the user to the login page and brings them back afterwards.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, error } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const signedOut = isUnauthorized(error);

  useEffect(() => {
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [signedOut, router, pathname]);

  if (user) return children;

  if (error && !signedOut) {
    return (
      <p role="alert" className="py-16 text-center text-muted-foreground">
        Couldn&apos;t load your account. Check your connection and refresh the page.
      </p>
    );
  }

  return (
    <div className="space-y-4 py-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
