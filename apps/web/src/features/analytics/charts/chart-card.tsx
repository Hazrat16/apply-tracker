'use client';

import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  description?: string;
  /** The accessible twin of the chart: every value as a table. */
  table?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Card with a chart/table toggle, so no value is only reachable by hovering a mark. */
export function ChartCard({ title, description, table, children, className }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={cn('min-w-0 rounded-xl border bg-card p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <figcaption>
          <p className="font-medium">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </figcaption>
        {table && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={showTable}
            aria-label={showTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? <BarChart3 /> : <Table2 />}
          </Button>
        )}
      </div>
      {showTable && table ? table : children}
    </figure>
  );
}

/** Plain data table used as every chart's table view. */
export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {columns.map((column, i) => (
              <th
                key={column}
                scope="col"
                className={cn('py-1.5 font-medium', i > 0 && 'text-right')}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b last:border-0">
              {row.map((cell, i) => (
                <td key={i} className={cn('py-1.5', i > 0 && 'text-right tabular-nums')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
