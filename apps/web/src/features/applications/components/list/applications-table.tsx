'use client';

import type {
  ApplicationListParams,
  ApplicationSortField,
  ApplicationSummary,
} from '@apply-tracker/shared';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDateOnly, formatPlace, formatSalary, timeAgo } from '../../format';
import { StatusBadge } from '../status-badge';
import { TagBadge } from '../tag-badge';

interface ApplicationsTableProps {
  items: ApplicationSummary[];
  params: ApplicationListParams;
  onSort: (sort: ApplicationSortField, order: 'asc' | 'desc') => void;
}

function SortHeader({
  field,
  label,
  params,
  onSort,
  className,
}: {
  field: ApplicationSortField;
  label: string;
  params: ApplicationListParams;
  onSort: ApplicationsTableProps['onSort'];
  className?: string;
}) {
  const active = params.sort === field;
  const Icon = !active ? ArrowUpDown : params.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (params.order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field, active && params.order === 'asc' ? 'desc' : 'asc')}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'text-muted-foreground/60')} aria-hidden />
      </button>
    </TableHead>
  );
}

export function ApplicationsTable({ items, params, onSort }: ApplicationsTableProps) {
  const sortProps = { params, onSort };
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader field="role" label="Role" {...sortProps} />
            <SortHeader field="company" label="Company" {...sortProps} />
            <SortHeader field="status" label="Status" {...sortProps} />
            <TableHead>Location</TableHead>
            <TableHead>Salary</TableHead>
            <SortHeader field="appliedAt" label="Applied" {...sortProps} />
            <SortHeader field="updatedAt" label="Updated" {...sortProps} className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((app) => (
            <TableRow key={app.id} className="relative">
              <TableCell className="max-w-72">
                <Link
                  href={`/applications/${app.id}`}
                  // Stretched link: the whole row is clickable.
                  className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {app.roleTitle}
                </Link>
                {app.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {app.tags.map((tag) => (
                      <TagBadge key={tag.id} tag={tag} />
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>{app.company.name}</TableCell>
              <TableCell>
                <StatusBadge status={app.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatPlace(app.location, app.workMode) || '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatSalary(app.salaryMin, app.salaryMax, app.currency) ?? '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {app.appliedAt ? formatDateOnly(app.appliedAt) : '—'}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                {timeAgo(app.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
