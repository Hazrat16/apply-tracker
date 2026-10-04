'use client';

import { type AnalyticsRange, analyticsSchema } from '@apply-tracker/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { KanbanSquare } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink } from '@/components/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FunnelChart } from './charts/funnel-chart';
import { GoalCard } from './charts/goal-card';
import { KpiRow } from './charts/kpi-row';
import { PipelineBars } from './charts/pipeline-bars';
import { SourcesTable } from './charts/sources-table';
import { WeeklyChart } from './charts/weekly-chart';

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All time' },
];

function RangeFilter({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      className="inline-flex rounded-lg border bg-card p-0.5"
    >
      {RANGES.map((range) => (
        <button
          key={range.value}
          type="button"
          role="radio"
          aria-checked={value === range.value}
          onClick={() => onChange(range.value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground',
            value === range.value && 'bg-muted font-medium text-foreground',
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

export function DashboardView() {
  const [range, setRange] = useState<AnalyticsRange>('90d');
  const { data, isPending, error, isPlaceholderData } = useQuery({
    queryKey: ['analytics', range],
    queryFn: ({ signal }) =>
      apiFetch(`/v1/analytics?range=${range}`, { schema: analyticsSchema, signal }),
    // Keep the previous charts (dimmed) while a new range loads: no layout jump.
    placeholderData: keepPreviousData,
  });

  const hasApplications = !!data && data.pipeline.some((p) => p.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">How your job search is going.</p>
        </div>
      </div>

      {/* One filter row, above everything it scopes. */}
      <RangeFilter value={range} onChange={setRange} />

      {isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading dashboard">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : error ? (
        <p role="alert" className="py-16 text-center text-muted-foreground">
          Couldn&apos;t load your dashboard. {error.message}
        </p>
      ) : !hasApplications ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <KanbanSquare className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Your dashboard fills in as you apply</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add applications and move them along your board — reply rates, your funnel and weekly
            progress appear here.
          </p>
          <ButtonLink href="/board" className="mt-2">
            Go to your board
          </ButtonLink>
        </div>
      ) : (
        <div className={cn('space-y-4 transition-opacity', isPlaceholderData && 'opacity-60')}>
          <KpiRow data={data} />
          <div className="grid gap-4 lg:grid-cols-3">
            <WeeklyChart data={data} />
            <GoalCard data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FunnelChart data={data} />
            <PipelineBars data={data} />
          </div>
          <SourcesTable data={data} />
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">How these numbers are calculated</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Applied</strong>: applications that left your
                wishlist, counted by the date you applied (in the selected period).
              </li>
              <li>
                <strong className="text-foreground">Reply</strong>: the company responded — an
                assessment, interview, offer or rejection. Ghosted and withdrawn applications
                don&apos;t count as replies.
              </li>
              <li>
                <strong className="text-foreground">Typical reply time</strong>: the median number
                of days from applying to the first reply.
              </li>
              <li>
                Changes compare with the previous period of the same length. Archived applications
                are included.
              </li>
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
