import type { ApplicationStatus, ApplicationSummary } from '@apply-tracker/shared';
import { APPLICATION_STATUSES } from '@apply-tracker/shared';

export type Columns = Record<ApplicationStatus, string[]>;

export function emptyColumns(): Columns {
  return Object.fromEntries(
    APPLICATION_STATUSES.map((status) => [status, []]),
  ) as unknown as Columns;
}

/** Card ids per column, in board order (the API returns cards sorted by position). */
export function groupByStatus(applications: ApplicationSummary[]): Columns {
  const columns = emptyColumns();
  for (const application of applications) columns[application.status].push(application.id);
  return columns;
}

export function findColumn(columns: Columns, id: string): ApplicationStatus | undefined {
  return APPLICATION_STATUSES.find((status) => columns[status].includes(id));
}

/** Returns new columns with `id` moved to `toStatus` at `index` (clamped). */
export function moveCard(
  columns: Columns,
  id: string,
  toStatus: ApplicationStatus,
  index: number,
): Columns {
  const from = findColumn(columns, id);
  if (!from) return columns;

  const next = { ...columns, [from]: columns[from].filter((cardId) => cardId !== id) };
  const target = [...next[toStatus]];
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id);
  next[toStatus] = target;
  return next;
}

/** The cards directly above and below `id` — what the move API needs to position it. */
export function neighbours(columns: Columns, status: ApplicationStatus, id: string) {
  const column = columns[status];
  const index = column.indexOf(id);
  return { beforeId: column[index - 1] ?? null, afterId: column[index + 1] ?? null };
}

/** Applies a move to cached board data so the UI updates before the server responds. */
export function applyMoveToBoard(
  board: ApplicationSummary[],
  columns: Columns,
  id: string,
  status: ApplicationStatus,
): ApplicationSummary[] {
  const order = new Map(
    APPLICATION_STATUSES.flatMap((s) => columns[s]).map((cardId, i) => [cardId, i]),
  );
  return board
    .map((app) => (app.id === id ? { ...app, status } : app))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
