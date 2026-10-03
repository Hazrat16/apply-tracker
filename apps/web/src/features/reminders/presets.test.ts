import { reminderPresets } from './presets';

describe('reminderPresets', () => {
  it('offers future times at 9:00 local time', () => {
    const now = new Date(2026, 9, 7, 15, 30); // Wednesday 7 Oct 2026, 15:30
    const presets = reminderPresets(now);
    expect(presets.map((p) => p.label)).toEqual([
      'Tomorrow',
      'In 3 days',
      'Next Monday',
      'In a week',
    ]);
    expect(presets.map((p) => [p.date.getDate(), p.date.getHours()])).toEqual([
      [8, 9],
      [10, 9],
      [12, 9],
      [14, 9],
    ]);
  });
});
