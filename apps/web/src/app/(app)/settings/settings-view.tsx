'use client';

import { useMe } from '@/features/auth/hooks';
import { ConnectedAccounts } from '@/features/settings/connected-accounts';
import { DeleteAccount } from '@/features/settings/delete-account';
import { NotificationSettings } from '@/features/settings/notification-settings';
import { PasswordForm } from '@/features/settings/password-form';
import { ProfileForm } from '@/features/settings/profile-form';
import { ResumesSettings } from '@/features/settings/resumes-settings';
import { TagsSettings } from '@/features/settings/tags-settings';

export function SettingsView() {
  // AuthGate guarantees the user is loaded before this renders.
  const { data: user } = useMe();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ProfileForm user={user} />
      <PasswordForm key={String(user.hasPassword)} user={user} />
      <ResumesSettings />
      <NotificationSettings />
      <ConnectedAccounts user={user} />
      <TagsSettings />
      <DeleteAccount user={user} />
    </div>
  );
}
