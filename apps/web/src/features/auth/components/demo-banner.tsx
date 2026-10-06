'use client';

import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '../api';
import { useMe } from '../hooks';

const hoursLeft = (iso: string) =>
  Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));

export function DemoBanner() {
  const { data: user } = useMe();
  if (!user?.isDemo || !user.demoExpiresAt) return null;

  const hours = hoursLeft(user.demoExpiresAt);

  return (
    <div className="border-b bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          You&apos;re exploring a demo account with sample data. Change anything you like —
          it&apos;s deleted in about {hours} hour{hours === 1 ? '' : 's'}.
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-current"
          onClick={() =>
            authApi
              .logout()
              .catch(() => undefined)
              // Full load so no demo data lingers in the cache.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload is intentional
              .finally(() => window.location.assign('/register'))
          }
        >
          Create your own account
        </Button>
      </div>
    </div>
  );
}
