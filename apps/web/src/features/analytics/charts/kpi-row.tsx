import type { Analytics } from '@apply-tracker/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { percent, pointsDelta } from '../format';

interface StatTileProps {
  label: string;
  value: string;
  detail?: string;
  /** Change vs the previous period, in percentage points (higher is better for every rate here). */
  delta?: number | null;
  hero?: boolean;
}

function StatTile({ label, value, detail, delta, hero }: StatTileProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', hero && 'col-span-2 lg:col-span-1')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-semibold tracking-tight',
          hero ? 'text-5xl' : 'text-2xl sm:text-3xl',
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 text-xs">
        {delta !== undefined && delta !== null && delta !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              delta > 0 ? 'text-viz-delta-good' : 'text-viz-delta-bad',
            )}
          >
            {delta > 0 ? (
              <ArrowUp className="size-3" aria-hidden />
            ) : (
              <ArrowDown className="size-3" aria-hidden />
            )}
            {Math.abs(delta)} pts
            <span className="sr-only">
              {delta > 0 ? 'higher' : 'lower'} than the previous period
            </span>
          </span>
        )}
        {delta === 0 && <span className="text-muted-foreground">No change</span>}
        {detail && <span className="text-muted-foreground">{detail}</span>}
      </div>
    </div>
  );
}

export function KpiRow({ data }: { data: Analytics }) {
  const prev = data.previousRates;
  const vsPrevious = prev ? 'vs previous period' : undefined;
  const { applied, responded, interviewed, offers } = data.totals;
  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        hero
        label="Applications sent"
        value={applied.toLocaleString()}
        detail={`${data.totals.responded} replies`}
      />
      <StatTile
        label="Response rate"
        value={percent(data.rates.response)}
        delta={pointsDelta(data.rates.response, prev?.response)}
        detail={applied ? `${responded} of ${applied}` : vsPrevious}
      />
      <StatTile
        label="Interview rate"
        value={percent(data.rates.interview)}
        delta={pointsDelta(data.rates.interview, prev?.interview)}
        detail={applied ? `${interviewed} of ${applied}` : vsPrevious}
      />
      <StatTile
        label="Offer rate"
        value={percent(data.rates.offer)}
        delta={pointsDelta(data.rates.offer, prev?.offer)}
        detail={applied ? `${offers} of ${applied}` : vsPrevious}
      />
      <StatTile
        label="Typical reply time"
        value={
          data.medianDaysToResponse === null ? '—' : `${Math.round(data.medianDaysToResponse)} d`
        }
        detail={
          data.responseTimesMeasured
            ? `median of ${data.responseTimesMeasured} repl${data.responseTimesMeasured === 1 ? 'y' : 'ies'}`
            : 'no replies yet'
        }
      />
    </section>
  );
}
