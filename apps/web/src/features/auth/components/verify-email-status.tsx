'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ButtonLink } from '@/components/button-link';
import { authApi } from '../api';
import { meQueryKey } from '../hooks';

export function VerifyEmailStatus() {
  const token = useSearchParams().get('token');
  const queryClient = useQueryClient();

  // A query (not a mutation) so the single-use token is submitted exactly once,
  // even when React mounts the component twice in development.
  const { isPending, isError, error } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      await authApi.verifyEmail(token!);
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      return true;
    },
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (!token || isError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>
            {error?.message ?? 'This verification link is incomplete.'} You can request a new link
            from the banner at the top of the app.
          </AlertDescription>
        </Alert>
        <ButtonLink href="/board" className="w-full">
          Go to your board
        </ButtonLink>
      </div>
    );
  }

  if (isPending) {
    return (
      <p className="flex items-center justify-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Verifying your email…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <CircleCheck />
        <AlertTitle>Email verified</AlertTitle>
        <AlertDescription>Thanks for confirming your email address.</AlertDescription>
      </Alert>
      <ButtonLink href="/board" className="w-full">
        Continue to your board
      </ButtonLink>
    </div>
  );
}
