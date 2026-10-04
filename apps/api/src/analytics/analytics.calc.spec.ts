import type { ApplicationStatus } from '@apply-tracker/shared';
import { type AnalyticsInput, computeAnalytics } from './analytics.calc.js';
import { addDays, weekStart } from './local-dates.js';

// Thursday 8 Oct 2026, 10:00 UTC
const NOW = new Date('2026-10-08T10:00:00Z');
const at = (date: string) => new Date(`${date}T12:00:00Z`);

function app(
  path: [ApplicationStatus, string][],
  extra: Partial<AnalyticsInput> = {},
): AnalyticsInput {
  const history = path.map(([toStatus, date]) => ({ toStatus, changedAt: at(date) }));
  return {
    status: path.at(-1)![0],
    source: null,
    appliedAt: null,
    createdAt: at(path[0]![1]),
    archivedAt: null,
    history,
    ...extra,
  };
}

const run = (
  apps: AnalyticsInput[],
  range: '30d' | '90d' | '12m' | 'all' = '90d',
  weeklyGoal = 3,
) => computeAnalytics(apps, { range, timeZone: 'UTC', weeklyGoal, now: NOW });

describe('local dates', () => {
  it('finds the Monday of a week and adds days across months', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});

describe('computeAnalytics', () => {
  const sample = [
    // Applied → rejected after 5 days (a reply).
    app(
      [
        ['APPLIED', '2026-09-01'],
        ['REJECTED', '2026-09-06'],
      ],
      { source: 'LINKEDIN' },
    ),
    // Applied → assessment (3 days) → interview → offer.
    app(
      [
        ['WISHLIST', '2026-08-20'],
        ['APPLIED', '2026-09-10'],
        ['ASSESSMENT', '2026-09-13'],
        ['INTERVIEW', '2026-09-20'],
        ['OFFER', '2026-10-01'],
      ],
      { source: 'REFERRAL' },
    ),
    // Applied, ghosted: no reply.
    app(
      [
        ['APPLIED', '2026-09-15'],
        ['GHOSTED', '2026-10-01'],
      ],
      { source: 'LINKEDIN' },
    ),
    // Applied, still waiting; applied date set explicitly by the user.
    app([['APPLIED', '2026-10-06']], {
      appliedAt: new Date('2026-10-05T00:00:00Z'),
      source: 'LINKEDIN',
    }),
    // Still on the wishlist: not applied.
    app([['WISHLIST', '2026-10-01']]),
    // Applied long ago: outside 90 days.
    app([
      ['APPLIED', '2026-03-01'],
      ['INTERVIEW', '2026-03-11'],
    ]),
  ];

  it('computes totals, rates and the funnel for the range', () => {
    const result = run(sample);
    expect(result.from).toBe('2026-07-11');
    expect(result.to).toBe('2026-10-08');
    expect(result.totals).toEqual({ applied: 4, responded: 2, interviewed: 1, offers: 1 });
    expect(result.rates).toEqual({ response: 0.5, interview: 0.25, offer: 0.25 });
    expect(result.funnel.map((f) => f.count)).toEqual([4, 2, 1, 1]);
  });

  it('measures the median days to first reply', () => {
    // Replies after 5 days (rejection) and 3 days (assessment).
    const result = run(sample);
    expect(result.medianDaysToResponse).toBe(4);
    expect(result.responseTimesMeasured).toBe(2);
  });

  it('compares with the previous period of equal length', () => {
    const result = run(sample, '30d');
    // Last 30 days: applications from 9 Sep: 10 Sep (offer), 15 Sep (ghosted), 5 Oct (waiting).
    expect(result.totals.applied).toBe(3);
    // Previous 30 days (10 Aug – 8 Sep): only the 1 Sep rejection, which got a reply.
    expect(result.previousRates).toEqual({ response: 1, interview: 0, offer: 0 });
  });

  it('includes everything for all time, with no comparison', () => {
    const result = run(sample, 'all');
    expect(result.from).toBeNull();
    expect(result.totals.applied).toBe(5);
    expect(result.previousRates).toBeNull();
    expect(result.weekly[0]?.weekStart).toBe('2026-02-23'); // week of 1 Mar
  });

  it('fills every week of the range, including empty ones', () => {
    const result = run(sample, '30d');
    expect(result.weekly.map((w) => w.weekStart)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
    ]);
    expect(result.weekly.map((w) => w.applied)).toEqual([1, 1, 0, 0, 1]);
  });

  it('groups by source, most used first', () => {
    expect(run(sample).sources).toEqual([
      { source: 'LINKEDIN', applied: 3, responded: 1, interviewed: 0, offers: 0 },
      { source: 'REFERRAL', applied: 1, responded: 1, interviewed: 1, offers: 1 },
    ]);
  });

  it('reports the current pipeline, ignoring archived applications', () => {
    const archived = app([['APPLIED', '2026-10-01']], { archivedAt: NOW });
    const pipeline = run([...sample, archived]).pipeline;
    expect(pipeline.find((p) => p.status === 'APPLIED')?.count).toBe(1);
    expect(pipeline.find((p) => p.status === 'WISHLIST')?.count).toBe(1);
    expect(pipeline.map((p) => p.status)).toHaveLength(9);
  });

  it('counts the weekly goal and streak', () => {
    const appliedOn = (date: string) => app([['APPLIED', date]]);
    const week = (monday: string, n: number) =>
      Array.from({ length: n }, (_, i) => appliedOn(addDays(monday, i)));
    const apps = [
      ...week('2026-09-21', 3), // goal met
      ...week('2026-09-28', 4), // goal met
      ...week('2026-10-05', 2), // this week: not yet
      ...week('2026-09-07', 3), // met, but 14 Sep week breaks the streak
    ];
    expect(run(apps, '90d', 3).goal).toEqual({
      target: 3,
      thisWeek: 2,
      streak: 2,
      weekStart: '2026-10-05',
    });
    expect(run([...apps, appliedOn('2026-10-07')], '90d', 3).goal.streak).toBe(3);
    expect(run(apps, '90d', 0).goal.streak).toBe(0);
  });

  it('uses the user’s time zone for dates', () => {
    // 23:30 UTC on Sunday is already Monday in Berlin.
    const late = app([['APPLIED', '2026-10-04']], {});
    late.history[0]!.changedAt = new Date('2026-10-04T23:30:00Z');
    const berlin = computeAnalytics([late], {
      range: '30d',
      timeZone: 'Europe/Berlin',
      weeklyGoal: 1,
      now: NOW,
    });
    expect(berlin.goal.thisWeek).toBe(1);
    expect(run([late], '30d', 1).goal.thisWeek).toBe(0);
  });

  it('returns null rates with no applications', () => {
    const result = run([]);
    expect(result.rates).toEqual({ response: null, interview: null, offer: null });
    expect(result.medianDaysToResponse).toBeNull();
  });
});
