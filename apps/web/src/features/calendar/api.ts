import {
  type CalendarEvent,
  calendarEventSchema,
  type CalendarFeed,
  calendarFeedSchema,
} from '@apply-tracker/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { env } from '@/lib/env';

export const calendarApi = {
  events: (from: Date, to: Date, signal?: AbortSignal) =>
    apiFetch<CalendarEvent[]>(
      `/v1/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { schema: z.array(calendarEventSchema), signal },
    ),
  feed: () => apiFetch<CalendarFeed>('/v1/calendar/feed', { schema: calendarFeedSchema }),
  rotateFeed: () =>
    apiFetch<CalendarFeed>('/v1/calendar/feed', { method: 'POST', schema: calendarFeedSchema }),
  disableFeed: () => apiFetch('/v1/calendar/feed', { method: 'DELETE' }),
  downloadUrl: `${env.NEXT_PUBLIC_API_URL}/v1/calendar/applytracker.ics`,
};
