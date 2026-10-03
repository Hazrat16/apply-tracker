'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

/** Confirms deletion after the full-page redirect from settings, then cleans up the URL. */
export function AccountDeletedNotice() {
  const deleted = useSearchParams().get('account') === 'deleted';
  const router = useRouter();

  useEffect(() => {
    if (!deleted) return;
    toast.success('Your account has been deleted', { id: 'account-deleted' });
    router.replace('/');
  }, [deleted, router]);

  return null;
}
