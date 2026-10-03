import type { CalendarEvent } from '@apply-tracker/shared';
import { addDays } from 'date-fns';
import { groupByDay } from './agenda';

const event = (id: string, start: Date): CalendarEvent => ({
  id,
  kind: 'reminder',
  title: id,
  start: start.toISOString(),
  end: start.toISOString(),
  location: null,
  link: null,
  completed: false,
});

describe('groupByDay', () => {
  it('groups by local day and labels today and tomorrow', () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const days = groupByDay([
      event('a', today),
      event('b', new Date(today.getTime() + 60_000)),
      event('c', addDays(today, 1)),
      event('d', addDays(today, 5)),
    ]);
    expect(days.map((day) => [day.label, day.events.map((e) => e.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Tomorrow', ['c']],
      [expect.stringMatching(/^\w+day \d+ \w+$/), ['d']],
    ]);
  });
});
