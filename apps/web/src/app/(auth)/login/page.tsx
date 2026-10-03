import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to your job search dashboard" />
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-foreground underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </>
  );
}
