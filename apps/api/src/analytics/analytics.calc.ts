import type {
  Analytics,
  AnalyticsRange,
  ApplicationSource,
  ApplicationStatus,
} from '@apply-tracker/shared';
import { APPLICATION_STATUSES } from '@apply-tracker/shared';
import { localTime } from '../automation/local-time.js';
import { addDays, daysBetween, weekStart } from './local-dates.js';

/**
 * Metric definitions (also shown in the UI):
 * - Applied: the application left the wishlist (applied date set, or any status beyond Wishlist).
 * - Responded: the company replied — it reached Assessment, Interview, Offer, Accepted or Rejected.
 *   Ghosted and withdrawn applications count as no reply.
 * - Interview: reached Interview (or got an offer). Offer: reached Offer or Accepted.
 * - Days to response: from the applied date to the first reply.
 */
const RESPONSE: ApplicationStatus[] = ['ASSESSMENT', 'INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED'];
const INTERVIEW: ApplicationStatus[] = ['INTERVIEW', 'OFFER', 'ACCEPTED'];
const OFFER: ApplicationStatus[] = ['OFFER', 'ACCEPTED'];

const RANGE_DAYS: Record<Exclude<AnalyticsRange, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
};
/** All-time weekly charts start at most this many weeks back. */
const MAX_WEEKS = 104;

export interface AnalyticsInput {
  status: ApplicationStatus;
  source: ApplicationSource | null;
  /** Calendar date chosen by the user (`@db.Date`, UTC midnight). */
  appliedAt: Date | null;
  createdAt: Date;
  archivedAt: Date | null;
  history: { toStatus: ApplicationStatus; changedAt: Date }[];
}

interface Outcome {
  appliedOn: string | null;
  responded: boolean;
  interviewed: boolean;
  offer: boolean;
  daysToResponse: number | null;
}

function outcome(app: AnalyticsInput, timeZone: string): Outcome {
  const reached = new Set<ApplicationStatus>([app.status, ...app.history.map((h) => h.toStatus)]);
  const localDate = (date: Date) => localTime(date, timeZone).date;
  const history = [...app.history].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());

  const leftWishlist = history.find((h) => h.toStatus !== 'WISHLIST');
  const appliedOn = app.appliedAt
    ? app.appliedAt.toISOString().slice(0, 10)
    : leftWishlist
      ? localDate(leftWishlist.changedAt)
      : app.status !== 'WISHLIST'
        ? localDate(app.createdAt)
        : null;

  const firstReply = history.find((h) => RESPONSE.includes(h.toStatus));
  const daysToResponse =
    appliedOn && firstReply
      ? Math.max(0, daysBetween(appliedOn, localDate(firstReply.changedAt)))
      : null;

  return {
    appliedOn,
    responded: RESPONSE.some((s) => reached.has(s)),
    interviewed: INTERVIEW.some((s) => reached.has(s)),
    offer: OFFER.some((s) => reached.has(s)),
    daysToResponse,
  };
}

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function summarise(outcomes: Outcome[]) {
  const applied = outcomes.length;
  const responded = outcomes.filter((o) => o.responded).length;
  const interviewed = outcomes.filter((o) => o.interviewed).length;
  const offers = outcomes.filter((o) => o.offer).length;
  return {
    totals: { applied, responded, interviewed, offers },
    rates: {
      response: ratio(responded, applied),
      interview: ratio(interviewed, applied),
      offer: ratio(offers, applied),
    },
  };
}

export function computeAnalytics(
  apps: AnalyticsInput[],
  options: { range: AnalyticsRange; timeZone: string; weeklyGoal: number; now: Date },
): Analytics {
  const today = localTime(options.now, options.timeZone).date;
  const outcomes = apps.map((app) => ({ app, ...outcome(app, options.timeZone) }));
  const applied = outcomes.filter(
    (o): o is typeof o & { appliedOn: string } => o.appliedOn !== null,
  );

  const days = options.range === 'all' ? null : RANGE_DAYS[options.range];
  const from = days === null ? null : addDays(today, -(days - 1));
  const inRange = applied.filter((o) => from === null || o.appliedOn >= from);
  const previous =
    days === null || from === null
      ? null
      : applied.filter((o) => o.appliedOn >= addDays(from, -days) && o.appliedOn < from);

  const current = summarise(inRange);
  const responseTimes = inRange.map((o) => o.daysToResponse).filter((d): d is number => d !== null);

  // Weekly volume: every week in the range, including empty ones.
  const thisWeek = weekStart(today);
  const earliest = inRange.reduce<string | null>(
    (min, o) => (min === null || o.appliedOn < min ? o.appliedOn : min),
    null,
  );
  let firstWeek = weekStart(from ?? earliest ?? today);
  if (daysBetween(firstWeek, thisWeek) / 7 >= MAX_WEEKS)
    firstWeek = addDays(thisWeek, -7 * (MAX_WEEKS - 1));
  const perWeek = new Map<string, number>();
  for (const o of applied)
    perWeek.set(weekStart(o.appliedOn), (perWeek.get(weekStart(o.appliedOn)) ?? 0) + 1);
  const weekly: Analytics['weekly'] = [];
  for (let week = firstWeek; week <= thisWeek; week = addDays(week, 7)) {
    weekly.push({ weekStart: week, applied: perWeek.get(week) ?? 0 });
  }

  // Sources, most used first.
  const bySource = new Map<ApplicationSource | null, typeof inRange>();
  for (const o of inRange) bySource.set(o.app.source, [...(bySource.get(o.app.source) ?? []), o]);
  const sources = [...bySource.entries()]
    .map(([source, items]) => ({ source, ...summarise(items).totals }))
    .sort((a, b) => b.applied - a.applied || (a.source ?? '~').localeCompare(b.source ?? '~'));

  // Current pipeline (not range-bound): every non-archived application.
  const pipelineCounts = new Map<ApplicationStatus, number>();
  for (const app of apps) {
    if (!app.archivedAt) pipelineCounts.set(app.status, (pipelineCounts.get(app.status) ?? 0) + 1);
  }
  const pipeline = APPLICATION_STATUSES.map((status) => ({
    status,
    count: pipelineCounts.get(status) ?? 0,
  }));

  // Weekly goal and streak (the current week only counts once the goal is reached).
  const goalTarget = options.weeklyGoal;
  const thisWeekCount = perWeek.get(thisWeek) ?? 0;
  let streak = 0;
  if (goalTarget > 0) {
    if (thisWeekCount >= goalTarget) streak++;
    for (
      let week = addDays(thisWeek, -7);
      (perWeek.get(week) ?? 0) >= goalTarget;
      week = addDays(week, -7)
    ) {
      streak++;
    }
  }

  return {
    range: options.range,
    from,
    to: today,
    totals: current.totals,
    rates: current.rates,
    previousRates: previous ? summarise(previous).rates : null,
    medianDaysToResponse: median(responseTimes),
    responseTimesMeasured: responseTimes.length,
    funnel: [
      { stage: 'APPLIED', count: current.totals.applied },
      { stage: 'RESPONDED', count: current.totals.responded },
      { stage: 'INTERVIEW', count: current.totals.interviewed },
      { stage: 'OFFER', count: current.totals.offers },
    ],
    weekly,
    sources,
    pipeline,
    goal: { target: goalTarget, thisWeek: thisWeekCount, streak, weekStart: thisWeek },
  };
}
