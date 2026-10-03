'use client';

import { healthResponseSchema } from '@apply-tracker/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Status = 'checking' | 'online' | 'degraded' | 'offline';

const LABELS: Record<Status, string> = {
  checking: 'Checking API…',
  online: 'API online',
  degraded: 'API degraded',
  offline: 'API offline',
};

const DOT: Record<Status, string> = {
  checking: 'bg-muted-foreground animate-pulse',
  online: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
};

export function ApiStatus() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch('/health', healthResponseSchema),
    retry: false,
    refetchInterval: 30_000,
  });

  let status: Status = 'checking';
  if (data) status = 'online';
  else if (error)
    status = error instanceof ApiError && error.status === 503 ? 'degraded' : 'offline';
  else if (!isPending) status = 'offline';

  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className={cn('size-2 rounded-full', DOT[status])} aria-hidden />
      {LABELS[status]}
    </span>
  );
}
