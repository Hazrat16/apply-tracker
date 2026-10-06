'use client';

import type { Analytics } from '@apply-tracker/shared';
import { percent } from '../format';
import { ChartCard, DataTable } from './chart-card';
import { useChartTooltip } from './use-tooltip';

const STAGE_LABELS: Record<Analytics['funnel'][number]['stage'], string> = {
  APPLIED: 'Applied',
  RESPONDED: 'Got a reply',
  INTERVIEW: 'Interviewed',
  OFFER: 'Offer',
};

/** Ordinal ramp: one hue, a step per stage (validated light and dark). */
const STAGE_FILL = [
  'var(--viz-funnel-1)',
  'var(--viz-funnel-2)',
  'var(--viz-funnel-3)',
  'var(--viz-funnel-4)',
];

export function FunnelChart({ data }: { data: Analytics }) {
  const { bind, element } = useChartTooltip();
  const top = data.funnel[0]?.count ?? 0;

  return (
    <ChartCard
      title="Funnel"
      description="How far your applications got"
      table={
        <DataTable
          columns={['Stage', 'Applications', '% of applied']}
          rows={data.funnel.map((s) => [
            STAGE_LABELS[s.stage],
            s.count,
            top ? percent(s.count / top) : '—',
          ])}
        />
      }
    >
      <div data-chart className="relative space-y-3">
        {data.funnel.map((stage, i) => {
          const share = top ? stage.count / top : 0;
          const previous = i > 0 ? data.funnel[i - 1]!.count : null;
          const conversion = previous
            ? `${percent(stage.count / previous)} of ${STAGE_LABELS[data.funnel[i - 1]!.stage].toLowerCase()}`
            : null;
          return (
            <div key={stage.stage} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
              <span className="text-sm text-muted-foreground">{STAGE_LABELS[stage.stage]}</span>
              <div className="flex items-center gap-2">
                <div
                  tabIndex={0}
                  role="img"
                  aria-label={`${STAGE_LABELS[stage.stage]}: ${stage.count}`}
                  className="h-6 rounded-r-[4px] outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    width: `max(${share * 100}%, 2px)`,
                    maxWidth: 'calc(100% - 5.5rem)',
                    background: STAGE_FILL[i],
                  }}
                  {...bind({
                    value: `${stage.count} (${percent(share)} of applied)`,
                    label: conversion ?? STAGE_LABELS[stage.stage],
                  })}
                />
                <span className="text-sm whitespace-nowrap">
                  <span className="font-medium">{stage.count}</span>
                  {i > 0 && top > 0 && (
                    <span className="ml-1 text-muted-foreground">{percent(share)}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        {element}
      </div>
    </ChartCard>
  );
}
