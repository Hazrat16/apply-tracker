'use client';

import { TAG_COLORS, type TagColor } from '@apply-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from './api';

const tagsKey = ['tags'] as const;

export function useTags() {
  return useQuery({
    queryKey: tagsKey,
    queryFn: ({ signal }) => tagsApi.list(signal),
    staleTime: 60_000,
  });
}

/** Stable colour per tag name, so a new tag always gets the same colour. */
export function colorForName(name: string): TagColor {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length]!;
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => tagsApi.create({ name, color: colorForName(name) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagsKey }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tagsKey });
      // Tags disappear from applications too.
      await queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
