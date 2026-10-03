import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <>
      <AuthHeader title="Create your account" description="Start tracking your applications" />
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
