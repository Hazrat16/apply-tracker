'use client';

import type { ApplicationStatus } from '@apply-tracker/shared';
import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BOARD_COLUMNS, CLOSED_STATUSES, STATUS_LABELS } from '../../constants';
import { type Columns, findColumn, groupByStatus, moveCard } from '../../board-utils';
import { useBoard, useMoveApplication } from '../../hooks';
import { ApplicationCard } from './application-card';
import { BoardColumn } from './board-column';

const COLUMN_PREFIX = 'column:';

export function Board() {
  const { data: applications, isPending, error } = useBoard();
  const move = useMoveApplication();

  const byId = useMemo(() => new Map(applications?.map((app) => [app.id, app])), [applications]);
  const serverColumns = useMemo(() => groupByStatus(applications ?? []), [applications]);
  // While dragging (and until the move is saved), the board shows this local layout.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = dragColumns ?? serverColumns;

  const sensors = useSensors(
    // A short distance threshold keeps plain clicks working as navigation.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space only: Enter stays free to open the card's link.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  /** Column the pointer is over: either a column itself or the column containing a card. */
  const targetColumn = (layout: Columns, overId: string): ApplicationStatus | undefined =>
    overId.startsWith(COLUMN_PREFIX)
      ? (overId.slice(COLUMN_PREFIX.length) as ApplicationStatus)
      : findColumn(layout, overId);

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragColumns(serverColumns);
  };

  // Moving between columns updates the layout live, so the target column opens a gap.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setDragColumns((layout) => {
      if (!layout) return layout;
      const id = String(active.id);
      const from = findColumn(layout, id);
      const to = targetColumn(layout, String(over.id));
      if (!from || !to || from === to) return layout;
      const overIndex = layout[to].indexOf(String(over.id));
      return moveCard(layout, id, to, overIndex === -1 ? layout[to].length : overIndex);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const id = String(active.id);
    const layout = dragColumns;
    const to = over && layout ? targetColumn(layout, String(over.id)) : undefined;
    if (!over || !layout || !to) {
      setDragColumns(null);
      return;
    }

    const overIndex = layout[to].indexOf(String(over.id));
    const final = moveCard(layout, id, to, overIndex === -1 ? layout[to].length : overIndex);

    const from = findColumn(serverColumns, id);
    const unchanged = from === to && serverColumns[to].indexOf(id) === final[to].indexOf(id);
    if (unchanged) {
      setDragColumns(null);
      return;
    }

    setDragColumns(final);
    move.mutate({ id, status: to, columns: final }, { onSettled: () => setDragColumns(null) });
  };

  const describe = (id: string | number) => {
    const app = byId.get(String(id));
    return app ? `${app.roleTitle} at ${app.company.name}` : 'Application';
  };
  const position = (id: string | number) => {
    const status = findColumn(columns, String(id));
    if (!status) return '';
    return `${STATUS_LABELS[status]}, position ${columns[status].indexOf(String(id)) + 1} of ${columns[status].length}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}. ${position(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.id)} is in ${position(active.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${describe(active.id)} in ${position(active.id)}.`
        : `Dropped ${describe(active.id)}.`,
    onDragCancel: ({ active }) => `Cancelled. ${describe(active.id)} was returned to its column.`,
  };

  if (isPending) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading board">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="py-16 text-center text-muted-foreground">
        Couldn&apos;t load your board. {error.message}
      </p>
    );
  }

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragColumns(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move this application, press Space. Use the arrow keys to move it between positions and columns, Space to drop it, or Escape to cancel. Press Enter on the title to open it.',
        },
      }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
        {BOARD_COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            muted={CLOSED_STATUSES.includes(status)}
            applications={columns[status]
              .map((id) => byId.get(id))
              .filter((app) => app !== undefined)}
          />
        ))}
      </div>
      <DragOverlay>{active ? <ApplicationCard application={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
