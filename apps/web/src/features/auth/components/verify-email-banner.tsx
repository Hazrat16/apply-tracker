'use client';

import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authApi } from '../api';
import { useMe } from '../hooks';

export function VerifyEmailBanner() {
  const { data: user } = useMe();
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success('Verification email sent', { description: user?.email }),
    onError: (error) => toast.error(error.message),
  });

  if (!user || user.emailVerified) return null;

  return (
    <div className="border-b bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <MailWarning className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          Please verify your email address. Check your inbox for the link.
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-current"
          onClick={() => resend.mutate()}
          disabled={resend.isPending || resend.isSuccess}
        >
          {resend.isSuccess ? 'Sent' : 'Resend email'}
        </Button>
      </div>
    </div>
  );
}
