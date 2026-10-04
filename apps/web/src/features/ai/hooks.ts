'use client';

import type { AiTaskStatus, CreateCoverLetterInput } from '@apply-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from './api';

export const aiKeys = {
  all: ['ai'] as const,
  status: ['ai', 'status'] as const,
  matches: (applicationId: string) => ['ai', 'matches', applicationId] as const,
  coverLetters: (applicationId: string) => ['ai', 'cover-letters', applicationId] as const,
};

export const isWorking = (status: AiTaskStatus) => status === 'PENDING' || status === 'RUNNING';

/** Polls while a background AI job is still working, then stops. */
const pollWhileWorking = (items: { status: AiTaskStatus }[] | undefined) =>
  items?.some((item) => isWorking(item.status)) ? 3000 : false;

export function useAiStatus() {
  return useQuery({
    queryKey: aiKeys.status,
    queryFn: ({ signal }) => aiApi.status(signal),
    staleTime: 5 * 60_000,
  });
}

export function useResumeMatches(applicationId: string) {
  return useQuery({
    queryKey: aiKeys.matches(applicationId),
    queryFn: ({ signal }) => aiApi.matches(applicationId, signal),
    refetchInterval: (query) => pollWhileWorking(query.state.data),
  });
}

export function useRequestMatch(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: string) => aiApi.requestMatch(applicationId, resumeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiKeys.matches(applicationId) }),
  });
}

export function useCoverLetters(applicationId: string) {
  return useQuery({
    queryKey: aiKeys.coverLetters(applicationId),
    queryFn: ({ signal }) => aiApi.coverLetters(applicationId, signal),
    refetchInterval: (query) => pollWhileWorking(query.state.data),
  });
}

function useInvalidateLetters(applicationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: aiKeys.coverLetters(applicationId) });
}

export function useRequestCoverLetter(applicationId: string) {
  const invalidate = useInvalidateLetters(applicationId);
  return useMutation({
    mutationFn: (input: CreateCoverLetterInput) => aiApi.requestCoverLetter(applicationId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCoverLetter(applicationId: string) {
  const invalidate = useInvalidateLetters(applicationId);
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      aiApi.updateCoverLetter(id, { content }),
    onSuccess: invalidate,
  });
}

export function useDeleteCoverLetter(applicationId: string) {
  const invalidate = useInvalidateLetters(applicationId);
  return useMutation({ mutationFn: aiApi.removeCoverLetter, onSuccess: invalidate });
}
