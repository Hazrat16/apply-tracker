'use client';

import { type LoginInput, loginSchema } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { FieldGroup } from '@/components/ui/field';
import { applyApiError } from '@/lib/form-errors';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { authApi } from '../api';
import { useSetMe } from '../hooks';
import { GoogleButton } from './google-button';

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: 'Google sign-in failed. Please try again.',
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setMe = useSetMe();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: LoginInput) => {
    try {
      setMe(await authApi.login(values));
      router.replace(safeRedirectPath(searchParams.get('next')));
    } catch (error) {
      applyApiError(error, setError, ['email', 'password']);
    }
  };

  const oauthError = OAUTH_ERRORS[searchParams.get('error') ?? ''];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <GoogleButton />
        <FormError message={errors.root?.message ?? oauthError} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          registration={register('email')}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password}
          labelAction={
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          }
        />
        <SubmitButton pending={isSubmitting} className="w-full">
          Sign in
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
