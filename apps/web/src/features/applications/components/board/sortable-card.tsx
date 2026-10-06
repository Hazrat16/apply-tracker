'use client';

import type { ApplicationSummary } from '@apply-tracker/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ApplicationCard } from './application-card';

export function SortableCard({ application }: { application: ApplicationSummary }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  return (
    // A plain list item: pointer drags start anywhere on the card, while the card's link is
    // its single keyboard stop (Enter opens it, Space picks it up). Giving the <li> the
    // default role="button" would nest the link inside a button.
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-manipulation rounded-lg', isDragging && 'opacity-40')}
      {...listeners}
    >
      <ApplicationCard
        application={application}
        linkProps={{
          ref: setActivatorNodeRef,
          'aria-describedby': attributes['aria-describedby'],
        }}
      />
    </li>
  );
}
