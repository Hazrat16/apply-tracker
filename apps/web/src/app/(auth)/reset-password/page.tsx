import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeader title="Choose a new password" description="You'll be signed out on all devices" />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
