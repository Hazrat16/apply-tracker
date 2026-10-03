'use client';

import { type ForgotPasswordInput, forgotPasswordSchema } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';
import { applyApiError } from '@/lib/form-errors';
import { authApi } from '../api';

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = async (values: ForgotPasswordInput) => {
    try {
      await authApi.forgotPassword(values);
      setSentTo(values.email);
    } catch (error) {
      applyApiError(error, setError, ['email']);
    }
  };

  if (sentTo) {
    return (
      <Alert>
        <MailCheck />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          If an account exists for {sentTo}, we sent a link to reset your password. It expires in 1
          hour.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError message={errors.root?.message} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          registration={register('email')}
          error={errors.email}
        />
        <SubmitButton pending={isSubmitting} className="w-full">
          Send reset link
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
