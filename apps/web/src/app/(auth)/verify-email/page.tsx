import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { VerifyEmailStatus } from '@/features/auth/components/verify-email-status';

export const metadata: Metadata = { title: 'Verify email' };

export default function VerifyEmailPage() {
  return (
    <>
      <AuthHeader title="Email verification" />
      <Suspense>
        <VerifyEmailStatus />
      </Suspense>
    </>
  );
}
