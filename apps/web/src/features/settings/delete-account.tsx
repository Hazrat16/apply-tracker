'use client';

import type { User } from '@apply-tracker/shared';
import { useId, useState } from 'react';
import { FormError } from '@/components/form/form-error';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authApi } from '@/features/auth/api';

export function DeleteAccount({ user }: { user: User }) {
  const passwordId = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const onDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await authApi.deleteAccount({ password: user.hasPassword ? password : undefined });
      // Full page load for the same reason as signing out: drop all of this user's client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload is intentional
      window.location.assign('/?account=deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and all of your data. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog onOpenChange={() => setError(undefined)}>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            Delete account
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form onSubmit={onDelete} className="space-y-4">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  All your applications, notes and settings will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <FormError message={error} />
              {user.hasPassword && (
                <Field>
                  <FieldLabel htmlFor={passwordId}>Confirm with your password</FieldLabel>
                  <Input
                    id={passwordId}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={pending || (user.hasPassword && !password)}
                >
                  {pending ? 'Deleting…' : 'Delete permanently'}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
