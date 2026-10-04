/** 0.4567 → "46%"; null → "—". */
export const percent = (value: number | null) =>
  value === null ? '—' : `${Math.round(value * 100)}%`;

/** Difference of two rates in percentage points, rounded; null when either side is missing. */
export function pointsDelta(
  current: number | null,
  previous: number | null | undefined,
): number | null {
  if (current === null || previous === null || previous === undefined) return null;
  return Math.round((current - previous) * 100);
}

/** Largest "nice" axis maximum ≥ value (1, 2, 5 × 10ⁿ steps). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * Integer axis for counts: a clean step (1, 2, 5, 10…) and a maximum rounded up to a
 * whole number of steps, so the top tick is always labelled.
 */
export function countAxis(value: number, targetTicks = 4): { max: number; ticks: number[] } {
  const step = Math.max(1, niceMax(Math.max(value, 1) / targetTicks));
  const max = Math.max(step, Math.ceil(value / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= max; tick += step) ticks.push(tick);
  return { max, ticks };
}
