import type { Analytics } from '@apply-tracker/shared';
import { SOURCE_LABELS } from '@/features/applications/constants';
import { percent } from '../format';

/** A rate that rests on fewer applications than this is flagged as tentative. */
const SMALL_SAMPLE = 3;

function RateMeter({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div
        className="hidden h-2 w-20 overflow-hidden rounded-full bg-viz-track sm:block"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-viz-series"
          style={{ width: `${(value ?? 0) * 100}%` }}
        />
      </div>
      <span className="w-10 text-right tabular-nums">
        <span className="sr-only">{label} </span>
        {percent(value)}
      </span>
    </div>
  );
}

export function SourcesTable({ data }: { data: Analytics }) {
  return (
    <figure className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <figcaption className="mb-4">
        <p className="font-medium">Where your replies come from</p>
        <p className="text-sm text-muted-foreground">
          Reply and interview rate by where you found the job
        </p>
      </figcaption>
      {data.sources.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No applications in this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-1.5 font-medium">
                  Source
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Applied
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Reply rate
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Interview rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((row) => (
                <tr key={row.source ?? 'none'} className="border-b last:border-0">
                  <td className="py-2">
                    {row.source ? (
                      SOURCE_LABELS[row.source]
                    ) : (
                      <span className="text-muted-foreground">Not recorded</span>
                    )}
                    {row.applied < SMALL_SAMPLE && (
                      <span className="ml-1.5 text-xs text-muted-foreground">· small sample</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{row.applied}</td>
                  <td className="py-2">
                    <RateMeter
                      label="Reply rate"
                      value={row.applied ? row.responded / row.applied : null}
                    />
                  </td>
                  <td className="py-2">
                    <RateMeter
                      label="Interview rate"
                      value={row.applied ? row.interviewed / row.applied : null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
