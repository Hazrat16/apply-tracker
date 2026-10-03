'use client';

import type { Reminder } from '@apply-tracker/shared';
import { isPast } from 'date-fns';
import { BellRing, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateTime } from '@/features/applications/format';
import { cn } from '@/lib/utils';
import { useDeleteReminder, useUpdateReminder } from './hooks';
import { ReminderDialog } from './reminder-dialog';

export function ReminderItem({
  reminder,
  showApplication,
}: {
  reminder: Reminder;
  showApplication?: boolean;
}) {
  const update = useUpdateReminder();
  const remove = useDeleteReminder();
  const done = reminder.completedAt !== null;
  const overdue = !done && isPast(new Date(reminder.dueAt));

  return (
    <li className="group flex items-start gap-3 rounded-lg border bg-card p-3">
      <Checkbox
        className="mt-0.5"
        checked={done}
        aria-label={done ? `Reopen “${reminder.title}”` : `Mark “${reminder.title}” as done`}
        onCheckedChange={(checked) =>
          update.mutate(
            { id: reminder.id, completed: checked === true },
            { onSuccess: () => checked && toast.success('Reminder done') },
          )
        }
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done && 'text-muted-foreground line-through')}>
          {reminder.title}
        </p>
        <p
          className={cn(
            'text-xs text-muted-foreground',
            overdue && 'font-medium text-red-600 dark:text-red-400',
          )}
        >
          {overdue && 'Overdue · '}
          {formatDateTime(reminder.dueAt)}
        </p>
        {showApplication && reminder.application && (
          <Link
            href={`/applications/${reminder.application.id}`}
            className="text-xs underline-offset-4 hover:underline"
          >
            {reminder.application.roleTitle} at {reminder.application.companyName}
          </Link>
        )}
        {reminder.note && <p className="mt-1 text-sm text-muted-foreground">{reminder.note}</p>}
      </div>
      <div className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {done ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Reopen reminder"
            onClick={() => update.mutate({ id: reminder.id, completed: false })}
          >
            <RotateCcw />
          </Button>
        ) : (
          <ReminderDialog
            reminder={reminder}
            trigger={
              <Button variant="ghost" size="icon-xs" aria-label="Edit reminder">
                <Pencil />
              </Button>
            }
          />
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete reminder"
          onClick={() =>
            remove.mutate(reminder.id, { onSuccess: () => toast.success('Reminder deleted') })
          }
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export function ReminderList({
  reminders,
  showApplication,
  empty,
}: {
  reminders: Reminder[];
  showApplication?: boolean;
  empty: string;
}) {
  if (reminders.length === 0) {
    return (
      <p className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        <BellRing className="size-5" aria-hidden />
        {empty}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {reminders.map((reminder) => (
        <ReminderItem key={reminder.id} reminder={reminder} showApplication={showApplication} />
      ))}
    </ul>
  );
}
