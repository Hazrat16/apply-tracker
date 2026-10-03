import { addDays, nextMonday, set } from 'date-fns';

/** Quick due-time choices, at 9:00 local time. */
export function reminderPresets(now = new Date()) {
  const nineAm = (date: Date) => set(date, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
  return [
    { label: 'Tomorrow', date: nineAm(addDays(now, 1)) },
    { label: 'In 3 days', date: nineAm(addDays(now, 3)) },
    { label: 'Next Monday', date: nineAm(nextMonday(now)) },
    { label: 'In a week', date: nineAm(addDays(now, 7)) },
  ];
}
