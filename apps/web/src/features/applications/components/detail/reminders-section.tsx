'use client';

import type { ApplicationDetail } from '@apply-tracker/shared';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReminders } from '@/features/reminders/hooks';
import { ReminderDialog } from '@/features/reminders/reminder-dialog';
import { ReminderList } from '@/features/reminders/reminder-list';

export function RemindersSection({ application }: { application: ApplicationDetail }) {
  const { data: reminders = [] } = useReminders({ applicationId: application.id, status: 'all' });
  const open = reminders.filter((reminder) => !reminder.completedAt);
  const done = reminders.filter((reminder) => reminder.completedAt);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReminderDialog
          applicationId={application.id}
          defaultTitle={`Follow up with ${application.company.name}`}
          trigger={
            <Button size="sm">
              <Plus aria-hidden />
              Set reminder
            </Button>
          }
        />
      </div>
      <ReminderList
        reminders={open}
        empty="No reminders yet. Set one to follow up at the right time."
      />
      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Done ({done.length})</summary>
          <div className="mt-2">
            <ReminderList reminders={done} empty="" />
          </div>
        </details>
      )}
    </div>
  );
}
