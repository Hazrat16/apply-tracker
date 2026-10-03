'use client';

import type { User } from '@apply-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';

export const meQueryKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: ({ signal }) => authApi.me(signal),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers'],
    queryFn: authApi.providers,
    staleTime: Infinity,
  });
}

/** Stores the signed-in user in the cache so protected pages render immediately. */
export function useSetMe() {
  const queryClient = useQueryClient();
  return (user: User) => queryClient.setQueryData(meQueryKey, user);
}

export function useLogout() {
  return useMutation({
    mutationFn: authApi.logout,
    // A full page load (rather than a client-side navigation) discards every cached query
    // and in-memory state from this user, and avoids racing with mounted auth-aware components.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload is intentional
    onSettled: () => window.location.assign('/login'),
  });
}
