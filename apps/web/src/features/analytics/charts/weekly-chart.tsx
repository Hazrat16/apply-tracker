'use client';

import type { Analytics } from '@apply-tracker/shared';
import { format, parseISO } from 'date-fns';
import { countAxis } from '../format';
import { ChartCard, DataTable } from './chart-card';
import { useChartTooltip } from './use-tooltip';

const PLOT_HEIGHT = 160;

export function WeeklyChart({ data }: { data: Analytics }) {
  const { bind, element } = useChartTooltip();
  const weeks = data.weekly;
  const goal = data.goal.target;
  const { max, ticks: yTicks } = countAxis(Math.max(goal, ...weeks.map((w) => w.applied)));
  // Label roughly six weeks along the axis, whatever the range.
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 6));
  const last = weeks.at(-1);

  return (
    <ChartCard
      className="lg:col-span-2"
      title="Applications per week"
      description={goal ? `Line shows your goal of ${goal} a week` : undefined}
      table={
        <DataTable
          columns={['Week of', 'Applications']}
          rows={[...weeks]
            .reverse()
            .map((w) => [format(parseISO(w.weekStart), 'd MMM yyyy'), w.applied])}
        />
      }
    >
      <div data-chart className="relative flex gap-2 pt-3">
        {/* y-axis */}
        <div
          className="relative w-6 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums"
          style={{ height: PLOT_HEIGHT }}
        >
          {yTicks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative border-b border-border" style={{ height: PLOT_HEIGHT }}>
            {/* hairline gridlines */}
            {yTicks.slice(1).map((tick) => (
              <div
                key={tick}
                className="absolute inset-x-0 border-t border-border/60"
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}
            {goal > 0 && (
              <div
                className="absolute inset-x-0 z-[1] border-t border-foreground/50"
                style={{ bottom: `${(goal / max) * 100}%` }}
              >
                <span className="absolute -top-4 right-0 text-[11px] text-muted-foreground">
                  Goal {goal}
                </span>
              </div>
            )}
            <div className="absolute inset-0 flex items-end gap-0.5">
              {weeks.map((week) => {
                const label = `Week of ${format(parseISO(week.weekStart), 'd MMM')}`;
                return (
                  <div
                    key={week.weekStart}
                    tabIndex={0}
                    aria-label={`${label}: ${week.applied} application${week.applied === 1 ? '' : 's'}`}
                    className="group flex h-full flex-1 items-end justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...bind({
                      value: `${week.applied} application${week.applied === 1 ? '' : 's'}`,
                      label,
                    })}
                  >
                    <div
                      className="w-full max-w-6 rounded-t-[4px] bg-viz-series transition-opacity group-hover:opacity-80"
                      style={{ height: week.applied ? `${(week.applied / max) * 100}%` : 0 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          {/* x-axis labels */}
          <div className="mt-1 flex gap-0.5 text-[11px] text-muted-foreground">
            {weeks.map((week, i) => (
              <span key={week.weekStart} className="flex-1 overflow-visible whitespace-nowrap">
                {i % labelEvery === 0 ? format(parseISO(week.weekStart), 'd MMM') : ''}
              </span>
            ))}
          </div>
        </div>
        {element}
      </div>
      {last && (
        <p className="mt-2 text-xs text-muted-foreground">
          This week so far: <span className="font-medium text-foreground">{last.applied}</span>
        </p>
      )}
    </ChartCard>
  );
}
