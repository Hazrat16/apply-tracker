'use client';

import type { CalendarEvent } from '@apply-tracker/shared';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfDay } from 'date-fns';
import { BellRing, CalendarClock, Download, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useReminders } from '@/features/reminders/hooks';
import { ReminderDialog } from '@/features/reminders/reminder-dialog';
import { ReminderList } from '@/features/reminders/reminder-list';
import { cn } from '@/lib/utils';
import { groupByDay } from './agenda';
import { calendarApi } from './api';
import { SubscribeDialog } from './subscribe-dialog';

const RANGE_DAYS = 30;

function EventRow({ event }: { event: CalendarEvent }) {
  const Icon = event.kind === 'interview' ? CalendarClock : BellRing;
  const content = (
    <>
      <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">
        {format(new Date(event.start), 'HH:mm')}
      </span>
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          event.kind === 'interview' ? 'text-amber-600' : 'text-blue-600',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-medium',
            event.completed && 'text-muted-foreground line-through',
          )}
        >
          {event.title}
        </span>
        {event.location && (
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {event.location}
          </span>
        )}
      </span>
    </>
  );
  const className = 'flex items-start gap-3 rounded-lg px-3 py-2';
  return event.link ? (
    <Link href={event.link} className={cn(className, 'hover:bg-muted')}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function CalendarView() {
  // Fixed for the lifetime of the page so the query key stays stable.
  const [range] = useState(() => {
    const from = startOfDay(new Date());
    return { from, to: addDays(from, RANGE_DAYS) };
  });
  const { data: events, isPending } = useQuery({
    queryKey: ['calendar', range.from.toISOString(), range.to.toISOString()],
    queryFn: ({ signal }) => calendarApi.events(range.from, range.to, signal),
  });
  const { data: openReminders = [] } = useReminders({ status: 'open' });
  const overdue = openReminders.filter((reminder) => new Date(reminder.dueAt) < range.from);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Interviews and reminders for the next {RANGE_DAYS} days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={calendarApi.downloadUrl}
            download
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <Download aria-hidden />
            Export .ics
          </a>
          <SubscribeDialog />
          <ReminderDialog
            trigger={
              <Button size="sm">
                <Plus aria-hidden />
                Reminder
              </Button>
            }
          />
        </div>
      </div>

      {overdue.length > 0 && (
        <section aria-labelledby="overdue-heading" className="space-y-3">
          <h2 id="overdue-heading" className="text-sm font-semibold text-red-600 dark:text-red-400">
            Overdue
          </h2>
          <ReminderList reminders={overdue} showApplication empty="" />
        </section>
      )}

      {isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : events && events.length > 0 ? (
        <div className="space-y-6">
          {groupByDay(events).map((day) => (
            <section key={day.key} aria-labelledby={`day-${day.key}`}>
              <h2 id={`day-${day.key}`} className="mb-1 px-3 text-sm font-semibold">
                {day.label}
              </h2>
              <div className="rounded-xl border bg-card py-1">
                {day.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Nothing scheduled. Add interviews on an application, or set a reminder.
        </p>
      )}
    </div>
  );
}
