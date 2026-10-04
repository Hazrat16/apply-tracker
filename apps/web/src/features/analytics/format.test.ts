import { countAxis, niceMax, percent, pointsDelta } from './format';

describe('analytics formatting', () => {
  it('formats rates as whole percentages', () => {
    expect(percent(0.4567)).toBe('46%');
    expect(percent(null)).toBe('—');
  });

  it('computes deltas in percentage points', () => {
    expect(pointsDelta(0.5, 0.25)).toBe(25);
    expect(pointsDelta(0.25, 0.5)).toBe(-25);
    expect(pointsDelta(0.5, null)).toBeNull();
  });

  it('rounds axis maxima to clean values', () => {
    expect([0, 1, 3, 7, 12, 48, 130].map(niceMax)).toEqual([1, 1, 5, 10, 20, 50, 200]);
  });

  it('builds count axes whose top tick is labelled', () => {
    expect(countAxis(5)).toEqual({ max: 6, ticks: [0, 2, 4, 6] });
    expect(countAxis(4)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(countAxis(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(countAxis(37)).toEqual({ max: 40, ticks: [0, 10, 20, 30, 40] });
  });
});
