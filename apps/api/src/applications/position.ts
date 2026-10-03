/** Gap left between cards so most moves only rewrite the moved card. */
export const POSITION_STEP = 1024;

/** Below this gap two neighbours are too close to split; the column needs renumbering. */
export const MIN_POSITION_GAP = 1e-6;

/**
 * Position for a card dropped between `before` (the card above) and `after` (the card below).
 * Returns `null` when the neighbours are too close together to fit a card between them.
 */
export function positionBetween(before?: number | null, after?: number | null): number | null {
  if (before == null && after == null) return 0;
  if (before == null) return after! - POSITION_STEP;
  if (after == null) return before + POSITION_STEP;
  if (after - before < MIN_POSITION_GAP) return null;
  return before + (after - before) / 2;
}

/** Evenly spaced positions for renumbering a column of `count` cards. */
export function evenlySpacedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index * POSITION_STEP);
}
