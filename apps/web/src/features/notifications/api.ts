import { type NotificationList, notificationListSchema } from '@apply-tracker/shared';
import { apiFetch } from '@/lib/api-client';

export const notificationsApi = {
  list: (signal?: AbortSignal) =>
    apiFetch<NotificationList>('/v1/notifications', { schema: notificationListSchema, signal }),
  read: (id: string) => apiFetch(`/v1/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => apiFetch('/v1/notifications/read-all', { method: 'POST' }),
};
