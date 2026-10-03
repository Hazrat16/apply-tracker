export interface LocalTime {
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  hour: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Wall-clock time in a time zone (falls back to UTC for unknown zones). */
export function localTime(at: Date, timeZone: string): LocalTime {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
  } catch {
    return localTime(at, 'UTC');
  }
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: WEEKDAYS.indexOf(get('weekday')) + 1,
    hour: Number(get('hour')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** "Tue 7 Oct, 14:30" in the user's time zone, for emails. */
export function formatInZone(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(at);
  } catch {
    return formatInZone(at, 'UTC');
  }
}
