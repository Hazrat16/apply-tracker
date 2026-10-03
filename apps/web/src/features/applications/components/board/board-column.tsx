'use client';

import type { ApplicationStatus, ApplicationSummary } from '@apply-tracker/shared';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '../../constants';
import { CreateApplicationDialog } from '../application-form-dialog';
import { StatusDot } from '../status-badge';
import { SortableCard } from './sortable-card';

export const columnId = (status: ApplicationStatus) => `column:${status}`;

interface BoardColumnProps {
  status: ApplicationStatus;
  applications: ApplicationSummary[];
  muted?: boolean;
}

export function BoardColumn({ status, applications, muted }: BoardColumnProps) {
  // The column itself is a drop target, so cards can be dropped into empty columns.
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const headingId = `column-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 p-2',
        muted && 'bg-muted/30',
        isOver && 'ring-2 ring-ring/40',
      )}
    >
      <header className="flex items-center justify-between px-1 pb-2">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-medium">
          <StatusDot status={status} />
          {STATUS_LABELS[status]}
          <span className="text-muted-foreground tabular-nums">{applications.length}</span>
        </h2>
        <CreateApplicationDialog
          status={status}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Add application to ${STATUS_LABELS[status]}`}
            >
              <Plus />
            </Button>
          }
        />
      </header>

      <SortableContext
        items={applications.map((app) => app.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {applications.map((app) => (
            <SortableCard key={app.id} application={app} />
          ))}
          {applications.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              Drop here
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}
