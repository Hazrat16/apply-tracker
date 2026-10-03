import { formatInZone, localTime } from './local-time.js';

describe('localTime', () => {
  // Monday 5 Oct 2026, 07:30 UTC
  const at = new Date('2026-10-05T07:30:00Z');

  it('converts to the local weekday, hour and date', () => {
    expect(localTime(at, 'UTC')).toEqual({ weekday: 1, hour: 7, date: '2026-10-05' });
    expect(localTime(at, 'Europe/Berlin')).toEqual({ weekday: 1, hour: 9, date: '2026-10-05' });
    expect(localTime(at, 'Asia/Dhaka')).toEqual({ weekday: 1, hour: 13, date: '2026-10-05' });
    // Still Sunday evening in Honolulu (UTC−10).
    expect(localTime(at, 'Pacific/Honolulu')).toEqual({ weekday: 7, hour: 21, date: '2026-10-04' });
  });

  it('falls back to UTC for unknown zones', () => {
    expect(localTime(at, 'Mars/Olympus')).toEqual(localTime(at, 'UTC'));
  });
});

describe('formatInZone', () => {
  it('formats in the given zone', () => {
    expect(formatInZone(new Date('2026-10-06T12:00:00Z'), 'Europe/Berlin')).toMatch(
      /Tue 6 Oct.*14:00/,
    );
  });
});
