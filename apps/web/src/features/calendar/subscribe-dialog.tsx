'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarSync, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { calendarApi } from './api';

export function SubscribeDialog() {
  const queryClient = useQueryClient();
  const feedKey = ['calendar-feed'];
  const { data: feed } = useQuery({ queryKey: feedKey, queryFn: calendarApi.feed });
  const rotate = useMutation({
    mutationFn: calendarApi.rotateFeed,
    onSuccess: (data) => queryClient.setQueryData(feedKey, data),
  });
  const disable = useMutation({
    mutationFn: calendarApi.disableFeed,
    onSuccess: () => queryClient.setQueryData(feedKey, { url: null }),
  });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('Calendar link copied');
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CalendarSync aria-hidden />
        Subscribe
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subscribe in your calendar</DialogTitle>
          <DialogDescription>
            Add this private link to Google Calendar (“From URL”), Outlook or Apple Calendar to see
            your interviews and reminders there. It updates automatically.
          </DialogDescription>
        </DialogHeader>
        {feed?.url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={feed.url}
                aria-label="Calendar subscription link"
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={() => void copy(feed.url!)}
              >
                <Copy />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can see your interview schedule. If it leaked, create a new one
              — the old link stops working.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => rotate.mutate()}
                disabled={rotate.isPending}
              >
                Create a new link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disable.mutate()}
                disabled={disable.isPending}
              >
                Turn off
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => rotate.mutate()} disabled={rotate.isPending}>
            Create my calendar link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
