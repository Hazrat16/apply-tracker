import type { ApplicationSummary } from '@apply-tracker/shared';
import { applyMoveToBoard, groupByStatus, moveCard, neighbours } from './board-utils';

const card = (id: string, status: ApplicationSummary['status']) =>
  ({ id, status }) as ApplicationSummary;
const board = [
  card('a', 'APPLIED'),
  card('b', 'APPLIED'),
  card('c', 'APPLIED'),
  card('d', 'INTERVIEW'),
];

describe('board utils', () => {
  it('groups cards by status, keeping order', () => {
    const columns = groupByStatus(board);
    expect(columns.APPLIED).toEqual(['a', 'b', 'c']);
    expect(columns.INTERVIEW).toEqual(['d']);
    expect(columns.OFFER).toEqual([]);
  });

  it('reorders within a column', () => {
    const columns = moveCard(groupByStatus(board), 'c', 'APPLIED', 0);
    expect(columns.APPLIED).toEqual(['c', 'a', 'b']);
    expect(neighbours(columns, 'APPLIED', 'c')).toEqual({ beforeId: null, afterId: 'a' });
  });

  it('moves across columns and reports neighbours', () => {
    const columns = moveCard(groupByStatus(board), 'b', 'INTERVIEW', 1);
    expect(columns.APPLIED).toEqual(['a', 'c']);
    expect(columns.INTERVIEW).toEqual(['d', 'b']);
    expect(neighbours(columns, 'INTERVIEW', 'b')).toEqual({ beforeId: 'd', afterId: null });
  });

  it('clamps out-of-range indexes', () => {
    expect(moveCard(groupByStatus(board), 'a', 'OFFER', 99).OFFER).toEqual(['a']);
  });

  it('applies a move to cached board data', () => {
    const columns = moveCard(groupByStatus(board), 'a', 'INTERVIEW', 0);
    const next = applyMoveToBoard(board, columns, 'a', 'INTERVIEW');
    expect(next.map((app) => `${app.id}:${app.status}`)).toEqual([
      'b:APPLIED',
      'c:APPLIED',
      'a:INTERVIEW',
      'd:INTERVIEW',
    ]);
  });
});
