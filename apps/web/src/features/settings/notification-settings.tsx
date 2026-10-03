'use client';

import {
  FOLLOW_UP_DAY_OPTIONS,
  type NotificationPreferences,
  notificationPreferencesSchema,
} from '@apply-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';

const preferencesKey = ['preferences'];
const getPreferences = () =>
  apiFetch<NotificationPreferences>('/v1/users/me/preferences', {
    schema: notificationPreferencesSchema,
  });
const savePreferences = (body: Partial<NotificationPreferences>) =>
  apiFetch<NotificationPreferences>('/v1/users/me/preferences', {
    method: 'PATCH',
    body,
    schema: notificationPreferencesSchema,
  });

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const allTimeZones = () =>
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const ids = { email: useId(), weekly: useId(), followUp: useId(), zone: useId() };
  const { data: prefs } = useQuery({ queryKey: preferencesKey, queryFn: getPreferences });
  const save = useMutation({
    mutationFn: savePreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesKey, data);
      toast.success('Notification settings saved');
    },
    onError: (error) => toast.error(error.message),
  });

  const zones = allTimeZones();
  const detected = browserTimeZone();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Reminders and suggestions always appear in the app; choose what you also get by email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!prefs ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-5">
            <Field orientation="horizontal">
              <Checkbox
                id={ids.email}
                checked={prefs.emailReminders}
                onCheckedChange={(checked) => save.mutate({ emailReminders: checked === true })}
              />
              <div>
                <FieldLabel htmlFor={ids.email}>
                  Email me reminders and interview heads-ups
                </FieldLabel>
                <FieldDescription>
                  When a reminder is due, and the day before an interview.
                </FieldDescription>
              </div>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id={ids.weekly}
                checked={prefs.weeklySummary}
                onCheckedChange={(checked) => save.mutate({ weeklySummary: checked === true })}
              />
              <div>
                <FieldLabel htmlFor={ids.weekly}>Weekly summary</FieldLabel>
                <FieldDescription>
                  Every Monday morning: your progress and what&apos;s coming up.
                </FieldDescription>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={ids.followUp}>Suggest a follow-up after</FieldLabel>
                <Select
                  items={Object.fromEntries(
                    FOLLOW_UP_DAY_OPTIONS.map((days) => [String(days), `${days} days of silence`]),
                  )}
                  value={String(prefs.followUpAfterDays)}
                  onValueChange={(value) =>
                    value && save.mutate({ followUpAfterDays: Number(value) })
                  }
                >
                  <SelectTrigger id={ids.followUp} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_DAY_OPTIONS.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} days of silence
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.zone}>Time zone</FieldLabel>
                <select
                  id={ids.zone}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                  value={prefs.timeZone}
                  onChange={(event) => save.mutate({ timeZone: event.target.value })}
                >
                  {[...new Set([prefs.timeZone, detected, ...zones])].map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace(/_/g, ' ')}
                      {zone === detected ? ' (this device)' : ''}
                    </option>
                  ))}
                </select>
                {prefs.timeZone !== detected && (
                  <FieldDescription>
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={() => save.mutate({ timeZone: detected })}
                    >
                      Use {detected.replace(/_/g, ' ')}
                    </button>
                  </FieldDescription>
                )}
              </Field>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
