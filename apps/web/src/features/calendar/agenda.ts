import type { CalendarEvent } from '@apply-tracker/shared';
import { format, isToday, isTomorrow } from 'date-fns';

export interface AgendaDay {
  /** Local date, YYYY-MM-DD. */
  key: string;
  label: string;
  events: CalendarEvent[];
}

/** Groups events by local calendar day, labelling today and tomorrow. */
export function groupByDay(events: CalendarEvent[]): AgendaDay[] {
  const days = new Map<string, AgendaDay>();
  for (const event of events) {
    const start = new Date(event.start);
    const key = format(start, 'yyyy-MM-dd');
    if (!days.has(key)) {
      const label = isToday(start)
        ? 'Today'
        : isTomorrow(start)
          ? 'Tomorrow'
          : format(start, 'EEEE d MMMM');
      days.set(key, { key, label, events: [] });
    }
    days.get(key)!.events.push(event);
  }
  return [...days.values()];
}
