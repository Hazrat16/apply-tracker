'use client';

import type { ApplicationSummary } from '@apply-tracker/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ApplicationCard } from './application-card';

export function SortableCard({ application }: { application: ApplicationSummary }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-40',
      )}
      aria-label={`${application.roleTitle} at ${application.company.name}`}
      {...attributes}
      {...listeners}
    >
      <ApplicationCard application={application} />
    </li>
  );
}
