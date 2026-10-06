'use client';

import type { Analytics } from '@apply-tracker/shared';
import Link from 'next/link';
import { STATUS_LABELS } from '@/features/applications/constants';
import { StatusDot } from '@/features/applications/components/status-badge';
import { ChartCard, DataTable } from './chart-card';
import { useChartTooltip } from './use-tooltip';

export function PipelineBars({ data }: { data: Analytics }) {
  const { bind, element } = useChartTooltip();
  const max = Math.max(1, ...data.pipeline.map((p) => p.count));
  const total = data.pipeline.reduce((sum, p) => sum + p.count, 0);

  return (
    <ChartCard
      title="Current pipeline"
      description={`${total} application${total === 1 ? '' : 's'} by current status (archived not included)`}
      table={
        <DataTable
          columns={['Status', 'Applications']}
          rows={data.pipeline.map((p) => [STATUS_LABELS[p.status], p.count])}
        />
      }
    >
      <ul data-chart className="relative space-y-2">
        {data.pipeline.map((row) => (
          <li
            key={row.status}
            className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm"
          >
            <Link
              href={`/applications?status=${row.status}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <StatusDot status={row.status} />
              {STATUS_LABELS[row.status]}
            </Link>
            <div className="h-4">
              {row.count > 0 && (
                <div
                  tabIndex={0}
                  role="img"
                  aria-label={`${STATUS_LABELS[row.status]}: ${row.count}`}
                  className="h-full rounded-r-[4px] bg-viz-series outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ width: `${(row.count / max) * 100}%` }}
                  {...bind({ value: String(row.count), label: STATUS_LABELS[row.status] })}
                />
              )}
            </div>
            <span className="text-right tabular-nums">{row.count}</span>
          </li>
        ))}
        {element}
      </ul>
    </ChartCard>
  );
}
