'use client';

import type { UpdateResumeInput } from '@apply-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resumesApi } from './api';

export const resumesKey = ['resumes'] as const;

export function useResumes() {
  return useQuery({
    queryKey: resumesKey,
    queryFn: ({ signal }) => resumesApi.list(signal),
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: resumesKey });
}

export function useUploadResume() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: resumesApi.upload, onSuccess: invalidate });
}

export function useRenameResume() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateResumeInput & { id: string }) =>
      resumesApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumesApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resumesKey });
      // Matches made with the resume are deleted too.
      await queryClient.invalidateQueries({ queryKey: ['ai'] });
    },
  });
}
