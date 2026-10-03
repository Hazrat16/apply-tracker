'use client';

import { registerSchema } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { FieldGroup } from '@/components/ui/field';
import { applyApiError } from '@/lib/form-errors';
import { authApi } from '../api';
import { useSetMe } from '../hooks';
import { GoogleButton } from './google-button';

// Confirmation is a UI concern only; the API receives the shared registerSchema shape.
const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function RegisterForm() {
  const router = useRouter();
  const setMe = useSetMe();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ name, email, password }: z.output<typeof registerFormSchema>) => {
    try {
      setMe(await authApi.register({ name, email, password }));
      toast.success('Account created', {
        description: `We sent a verification link to ${email}.`,
      });
      router.replace('/board');
    } catch (error) {
      applyApiError(error, setError, ['name', 'email', 'password']);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <GoogleButton />
        <FormError message={errors.root?.message} />
        <TextField
          label="Name"
          autoComplete="name"
          autoFocus
          registration={register('name')}
          error={errors.name}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          registration={register('email')}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters, with a letter and a number."
          registration={register('password')}
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          registration={register('confirmPassword')}
          error={errors.confirmPassword}
        />
        <SubmitButton pending={isSubmitting} className="w-full">
          Create account
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
