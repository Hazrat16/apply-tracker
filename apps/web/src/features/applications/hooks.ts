'use client';

import type {
  ApplicationListParams,
  ApplicationStatus,
  ApplicationSummary,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@apply-tracker/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { applicationsApi } from './api';
import { applyMoveToBoard, type Columns, neighbours } from './board-utils';
import { toApiQuery } from './list-params';

export const applicationKeys = {
  all: ['applications'] as const,
  board: () => [...applicationKeys.all, 'board'] as const,
  list: (params: ApplicationListParams) => [...applicationKeys.all, 'list', params] as const,
  detail: (id: string) => [...applicationKeys.all, 'detail', id] as const,
};

export function useBoard() {
  return useQuery({
    queryKey: applicationKeys.board(),
    queryFn: ({ signal }) => applicationsApi.board(signal),
  });
}

export function useApplicationList(params: ApplicationListParams) {
  return useQuery({
    queryKey: applicationKeys.list(params),
    queryFn: ({ signal }) => applicationsApi.list(toApiQuery(params), signal),
    // Keep showing the current page while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: applicationKeys.detail(id),
    queryFn: ({ signal }) => applicationsApi.get(id, signal),
  });
}

export function useCompanies(search: string) {
  return useQuery({
    queryKey: ['companies', search],
    queryFn: ({ signal }) => applicationsApi.companies(search, signal),
    staleTime: 60_000,
  });
}

/** Refetch every applications query (board, lists, details) after a change. */
function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: applicationKeys.all });
}

export function useCreateApplication() {
  const invalidate = useInvalidateApplications();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApplicationInput) => applicationsApi.create(input),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useUpdateApplication(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: (input: UpdateApplicationInput) => applicationsApi.update(id, input),
    onSuccess: async (detail) => {
      queryClient.setQueryData(applicationKeys.detail(id), detail);
      await invalidate();
    },
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidateApplications();
  return useMutation({ mutationFn: applicationsApi.remove, onSuccess: invalidate });
}

interface MoveVariables {
  id: string;
  status: ApplicationStatus;
  /** Board layout after the drop. */
  columns: Columns;
}

/** Board drag-and-drop with an optimistic update, rolled back if the server rejects it. */
export function useMoveApplication() {
  const queryClient = useQueryClient();
  const key = applicationKeys.board();

  return useMutation({
    mutationFn: ({ id, status, columns }: MoveVariables) =>
      applicationsApi.move(id, { status, ...neighbours(columns, status, id) }),
    onMutate: async ({ id, status, columns }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ApplicationSummary[]>(key);
      if (previous) queryClient.setQueryData(key, applyMoveToBoard(previous, columns, id, status));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error('Could not move the application', { description: error.message });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
  });
}

/**
 * Mutation on a child record (note, contact, interview) of an application.
 * Refreshes the application and the board (e.g. the "next interview" on cards).
 */
export function useApplicationItemMutation<TVariables, TData = unknown>(
  applicationId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      await queryClient.invalidateQueries({ queryKey: applicationKeys.board() });
    },
  });
}
