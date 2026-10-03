'use client';

import { passwordSchema } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { FieldGroup } from '@/components/ui/field';
import { applyApiError } from '@/lib/form-errors';
import { authApi } from '../api';

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <FormError message="This reset link is incomplete. Request a new one from the forgot password page." />
    );
  }

  const onSubmit = async ({ password }: z.output<typeof schema>) => {
    try {
      await authApi.resetPassword({ token, password });
      toast.success('Password updated', { description: 'Sign in with your new password.' });
      router.replace('/login');
    } catch (error) {
      applyApiError(error, setError, ['password']);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {errors.root && (
          <div className="space-y-2">
            <FormError message={errors.root.message} />
            <Link href="/forgot-password" className="text-sm underline underline-offset-4">
              Request a new link
            </Link>
          </div>
        )}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          autoFocus
          description="At least 8 characters, with a letter and a number."
          registration={register('password')}
          error={errors.password}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          registration={register('confirmPassword')}
          error={errors.confirmPassword}
        />
        <SubmitButton pending={isSubmitting} className="w-full">
          Update password
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
