'use client';

import { type UpdateProfileInput, updateProfileSchema, type User } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authApi } from '@/features/auth/api';
import { useSetMe } from '@/features/auth/hooks';
import { applyApiError } from '@/lib/form-errors';

export function ProfileForm({ user }: { user: User }) {
  const setMe = useSetMe();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name ?? '' },
  });

  const onSubmit = async (values: UpdateProfileInput) => {
    try {
      const updated = await authApi.updateProfile(values);
      setMe(updated);
      reset({ name: updated.name ?? '' });
      toast.success('Profile updated');
    } catch (error) {
      applyApiError(error, setError, ['name']);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear in ApplyTracker.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormError message={errors.root?.message} />
            <TextField
              label="Name"
              autoComplete="name"
              registration={register('name')}
              error={errors.name}
            />
            <Field>
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                {user.emailVerified ? (
                  <Badge variant="secondary">
                    <BadgeCheck aria-hidden /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Not verified</Badge>
                )}
              </div>
              <Input id="settings-email" value={user.email} disabled readOnly />
            </Field>
            <div>
              <SubmitButton pending={isSubmitting} disabled={!isDirty || isSubmitting}>
                Save changes
              </SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
