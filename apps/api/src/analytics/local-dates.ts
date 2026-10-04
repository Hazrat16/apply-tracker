/** Calendar-date arithmetic on `YYYY-MM-DD` strings (time-zone free, DST safe). */

const DAY = 86_400_000;

const toUtc = (date: string) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: string, days: number) => fromUtc(toUtc(date) + days * DAY);

/** Monday of the week containing `date` (ISO weeks start on Monday). */
export function weekStart(date: string): string {
  const weekday = (new Date(toUtc(date)).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(date, -weekday);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((toUtc(to) - toUtc(from)) / DAY);
