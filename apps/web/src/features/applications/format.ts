import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns';

/** "€70k–85k", "$120,000", or null when no salary is known. */
export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string,
): string | null {
  if (min == null && max == null) return null;
  const compact = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  if (min != null && max != null && min !== max) {
    return `${compact.format(min)}–${compact.format(max).replace(/^[^\d]+/, '')}`;
  }
  return compact.format((min ?? max)!);
}

/** `YYYY-MM-DD` → "3 Oct 2026". Parsed as a local date so it never shifts by a day. */
export const formatDateOnly = (value: string) => format(parseISO(value), 'd MMM yyyy');

export const formatDateTime = (iso: string) => format(new Date(iso), 'EEE d MMM yyyy, HH:mm');

export const timeAgo = (iso: string) => `${formatDistanceToNowStrict(new Date(iso))} ago`;

/** "Today 14:00", "Tomorrow 09:30", "Mon 6 Oct". */
export function formatUpcoming(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `Today ${format(date, 'HH:mm')}`;
  if (isTomorrow(date)) return `Tomorrow ${format(date, 'HH:mm')}`;
  return format(date, 'EEE d MMM');
}

/** ISO string → value for `<input type="datetime-local">` in the user's time zone. */
export const toDateTimeLocal = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
