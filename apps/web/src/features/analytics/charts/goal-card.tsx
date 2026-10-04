'use client';

import type { Analytics, NotificationPreferences } from '@apply-tracker/shared';
import { notificationPreferencesSchema } from '@apply-tracker/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Flame } from 'lucide-react';
import { useId } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';

const GOAL_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 15, 20];
const goalLabel = (goal: number) => (goal === 0 ? 'No goal' : `${goal} a week`);

export function GoalCard({ data }: { data: Analytics }) {
  const selectId = useId();
  const queryClient = useQueryClient();
  const { target, thisWeek, streak } = data.goal;
  const reached = target > 0 && thisWeek >= target;

  const setGoal = useMutation({
    mutationFn: (weeklyGoal: number) =>
      apiFetch<NotificationPreferences>('/v1/users/me/preferences', {
        method: 'PATCH',
        body: { weeklyGoal },
        schema: notificationPreferencesSchema,
      }),
    onSuccess: async (prefs) => {
      queryClient.setQueryData(['preferences'], prefs);
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section aria-labelledby="goal-heading" className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="goal-heading" className="font-medium">
            Weekly goal
          </h2>
          <p className="text-sm text-muted-foreground">Applications sent this week (Mon–Sun)</p>
        </div>
        <div>
          <label htmlFor={selectId} className="sr-only">
            Weekly goal
          </label>
          <Select
            items={Object.fromEntries(GOAL_OPTIONS.map((g) => [String(g), goalLabel(g)]))}
            value={String(target)}
            onValueChange={(value) => value !== null && setGoal.mutate(Number(value))}
          >
            <SelectTrigger id={selectId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {GOAL_OPTIONS.map((goal) => (
                <SelectItem key={goal} value={String(goal)}>
                  {goalLabel(goal)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {target === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Set a goal to track how many applications you send each week. {thisWeek} sent so far this
          week.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-3xl font-semibold tracking-tight">
            {thisWeek}
            <span className="text-lg font-normal text-muted-foreground"> / {target}</span>
          </p>
          <div
            role="meter"
            aria-label="Weekly goal progress"
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.min(thisWeek, target)}
            className="h-2.5 overflow-hidden rounded-full bg-viz-track"
          >
            <div
              className="h-full rounded-full bg-viz-series"
              style={{ width: `${Math.min(1, thisWeek / target) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {reached ? (
              <span className="inline-flex items-center gap-1 font-medium text-viz-delta-good">
                <CircleCheck className="size-4" aria-hidden />
                Goal reached
              </span>
            ) : (
              <span className="text-muted-foreground">{target - thisWeek} to go</span>
            )}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Flame className="size-4" aria-hidden />
              {streak === 0 ? 'No streak yet' : `${streak}-week streak`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
