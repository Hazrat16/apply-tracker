'use client';

import type { ApplicationStatus } from '@apply-tracker/shared';
import {
  type Announcements,
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BOARD_COLUMNS, CLOSED_STATUSES, STATUS_LABELS } from '../../constants';
import { type Columns, findColumn, groupByStatus, moveCard } from '../../board-utils';
import { useBoard, useMoveApplication } from '../../hooks';
import { ApplicationCard } from './application-card';
import { BoardColumn, columnId } from './board-column';

const COLUMN_PREFIX = 'column:';
const isColumnId = (id: string | number) => String(id).startsWith(COLUMN_PREFIX);

/**
 * Mouse/touch: whatever is under the pointer, preferring cards over empty column space.
 * Keyboard (no pointer): the closest drop target to the dragged card.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  if (underPointer.length > 0) {
    const cards = underPointer.filter((collision) => !isColumnId(collision.id));
    return cards.length > 0 ? cards : underPointer;
  }
  return closestCorners(args);
};

export function Board() {
  const { data: applications, isPending, error } = useBoard();
  const move = useMoveApplication();

  const byId = useMemo(() => new Map(applications?.map((app) => [app.id, app])), [applications]);
  const serverColumns = useMemo(() => groupByStatus(applications ?? []), [applications]);
  // While dragging (and until the move is saved), the board shows this local layout.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  // dnd-kit can call handlers captured in an earlier render, so they read the layout from a ref.
  const layoutRef = useRef<Columns | null>(null);
  const setLayout = (next: Columns | null) => {
    layoutRef.current = next;
    setDragColumns(next);
  };
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = dragColumns ?? serverColumns;

  /**
   * The built-in sortable keyboard handling only knows about one list: Left/Right would land
   * on a card in the same column. Here Left/Right jump to the top of the adjacent column.
   */
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') {
      return sortableKeyboardCoordinates(event, args);
    }
    event.preventDefault();
    const layout = layoutRef.current;
    const current = layout ? findColumn(layout, String(args.active)) : undefined;
    if (!current) return undefined;
    const next =
      BOARD_COLUMNS[BOARD_COLUMNS.indexOf(current) + (event.code === 'ArrowRight' ? 1 : -1)];
    const rect = next && args.context.droppableRects.get(columnId(next));
    return rect ? { x: rect.left, y: rect.top } : undefined;
  };

  const sensors = useSensors(
    // A short distance threshold keeps plain clicks working as navigation.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      // Space only: Enter stays free to open the card's link.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  /** Column the pointer is over: either a column itself or the column containing a card. */
  const targetColumn = (layout: Columns, overId: string): ApplicationStatus | undefined =>
    isColumnId(overId)
      ? (overId.slice(COLUMN_PREFIX.length) as ApplicationStatus)
      : findColumn(layout, overId);

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setLayout(serverColumns);
  };

  // Moving between columns updates the layout live, so the target column opens a gap.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const layout = layoutRef.current;
    if (!over || !layout) return;
    const id = String(active.id);
    const from = findColumn(layout, id);
    const to = targetColumn(layout, String(over.id));
    if (!from || !to || from === to) return;
    const overIndex = layout[to].indexOf(String(over.id));
    setLayout(moveCard(layout, id, to, overIndex === -1 ? layout[to].length : overIndex));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const id = String(active.id);
    const layout = layoutRef.current;
    const to = over && layout ? targetColumn(layout, String(over.id)) : undefined;
    if (!over || !layout || !to) {
      setLayout(null);
      return;
    }

    const overIndex = layout[to].indexOf(String(over.id));
    const final = moveCard(layout, id, to, overIndex === -1 ? layout[to].length : overIndex);

    const from = findColumn(serverColumns, id);
    const unchanged = from === to && serverColumns[to].indexOf(id) === final[to].indexOf(id);
    if (unchanged) {
      setLayout(null);
      return;
    }

    setLayout(final);
    move.mutate({ id, status: to, columns: final }, { onSettled: () => setLayout(null) });
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
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setLayout(null);
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
