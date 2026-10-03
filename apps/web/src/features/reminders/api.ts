import {
  type CreateReminderInput,
  type Reminder,
  type ReminderListQuery,
  reminderSchema,
  type UpdateReminderInput,
} from '@apply-tracker/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

export const remindersApi = {
  list: (query: ReminderListQuery = {}, signal?: AbortSignal) => {
    const search = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v) as [string, string][],
    );
    return apiFetch<Reminder[]>(`/v1/reminders?${search}`, {
      schema: z.array(reminderSchema),
      signal,
    });
  },
  create: (body: CreateReminderInput) =>
    apiFetch<Reminder>('/v1/reminders', { method: 'POST', body, schema: reminderSchema }),
  update: (id: string, body: UpdateReminderInput) =>
    apiFetch<Reminder>(`/v1/reminders/${id}`, { method: 'PATCH', body, schema: reminderSchema }),
  remove: (id: string) => apiFetch(`/v1/reminders/${id}`, { method: 'DELETE' }),
};
