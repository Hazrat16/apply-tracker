'use client';

import type {
  CreateReminderInput,
  ReminderListQuery,
  UpdateReminderInput,
} from '@apply-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from './api';

export const remindersKey = ['reminders'] as const;

export function useReminders(query: ReminderListQuery = {}) {
  return useQuery({
    queryKey: [...remindersKey, query],
    queryFn: ({ signal }) => remindersApi.list(query, signal),
  });
}

/** Reminders feed the calendar too, so every change refreshes both. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: remindersKey });
    await queryClient.invalidateQueries({ queryKey: ['calendar'] });
  };
}

export function useCreateReminder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateReminderInput) => remindersApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateReminder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateReminderInput & { id: string }) =>
      remindersApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteReminder() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: remindersApi.remove, onSuccess: invalidate });
}
