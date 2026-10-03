'use client';

import type { Notification, NotificationType } from '@apply-tracker/shared';
import { Bell, BellRing, CalendarClock, CheckCheck, MailQuestion, Newspaper } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { timeAgo } from '@/features/applications/format';
import { useCreateReminder } from '@/features/reminders/hooks';
import { reminderPresets } from '@/features/reminders/presets';
import { cn } from '@/lib/utils';
import { useMarkRead, useNotifications } from './hooks';

const ICONS: Record<NotificationType, typeof Bell> = {
  REMINDER_DUE: BellRing,
  FOLLOW_UP_SUGGESTED: MailQuestion,
  INTERVIEW_UPCOMING: CalendarClock,
  WEEKLY_SUMMARY: Newspaper,
};

function NotificationItem({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const router = useRouter();
  const markRead = useMarkRead();
  const createReminder = useCreateReminder();
  const Icon = ICONS[notification.type];
  const unread = notification.readAt === null;

  const open = () => {
    if (unread) markRead.mutate(notification.id);
    if (notification.link) {
      onOpen();
      router.push(notification.link);
    }
  };

  const remindLater = () => {
    const due = reminderPresets()[1]!.date;
    createReminder.mutate(
      {
        applicationId: notification.applicationId,
        title: notification.title.replace(/\?$/, ''),
        dueAt: due.toISOString(),
      },
      {
        onSuccess: () => {
          markRead.mutate(notification.id);
          toast.success('Reminder set for 3 days from now');
        },
      },
    );
  };

  return (
    <li className={cn('relative flex gap-3 px-3 py-2.5', unread && 'bg-muted/50')}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={open}
          className="text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          <p className={cn('text-sm', unread && 'font-medium')}>{notification.title}</p>
          {notification.body && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
          )}
        </button>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </span>
          {notification.type === 'FOLLOW_UP_SUGGESTED' && unread && (
            <Button
              variant="outline"
              size="xs"
              // Above the stretched button so it stays clickable.
              className="relative z-10"
              onClick={remindLater}
              disabled={createReminder.isPending}
            >
              Remind me in 3 days
            </Button>
          )}
        </div>
      </div>
      {unread && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />
      )}
    </li>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const unread = data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          />
        }
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markRead.mutate('all')}>
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          )}
        </div>
        {data?.items.length ? (
          <ul className="max-h-[min(28rem,70svh)] divide-y overflow-y-auto">
            {data.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={() => setOpen(false)}
              />
            ))}
          </ul>
        ) : (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up. Reminders, interview heads-ups and follow-up suggestions
            appear here.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
