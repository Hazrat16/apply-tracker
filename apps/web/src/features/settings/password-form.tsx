'use client';

import { passwordSchema, type User } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { authApi } from '@/features/auth/api';
import { meQueryKey } from '@/features/auth/hooks';
import { applyApiError } from '@/lib/form-errors';

const schema = z
  .object({
    currentPassword: z.string(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function PasswordForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async ({ currentPassword, newPassword }: z.output<typeof schema>) => {
    if (user.hasPassword && !currentPassword) {
      setError('currentPassword', { message: 'Current password is required' });
      return;
    }
    try {
      await authApi.changePassword({
        currentPassword: user.hasPassword ? currentPassword : undefined,
        newPassword,
      });
      reset();
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      toast.success(user.hasPassword ? 'Password changed' : 'Password set', {
        description: 'Other devices have been signed out.',
      });
    } catch (error) {
      applyApiError(error, setError, ['currentPassword', 'newPassword']);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.hasPassword ? 'Change password' : 'Set a password'}</CardTitle>
        <CardDescription>
          {user.hasPassword
            ? 'Changing your password signs you out on all other devices.'
            : 'Add a password so you can also sign in with your email.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormError message={errors.root?.message} />
            {user.hasPassword && (
              <TextField
                label="Current password"
                type="password"
                autoComplete="current-password"
                registration={register('currentPassword')}
                error={errors.currentPassword}
              />
            )}
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              description="At least 8 characters, with a letter and a number."
              registration={register('newPassword')}
              error={errors.newPassword}
            />
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              registration={register('confirmPassword')}
              error={errors.confirmPassword}
            />
            <div>
              <SubmitButton pending={isSubmitting}>
                {user.hasPassword ? 'Change password' : 'Set password'}
              </SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
