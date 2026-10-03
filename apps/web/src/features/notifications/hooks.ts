'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './api';

export const notificationsKey = ['notifications'] as const;

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: ({ signal }) => notificationsApi.list(signal),
    // New reminders and suggestions arrive from background jobs; poll gently.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') =>
      id === 'all' ? notificationsApi.readAll() : notificationsApi.read(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}
