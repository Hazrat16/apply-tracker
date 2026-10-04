import { z } from 'zod';
import { applicationSourceSchema, applicationStatusSchema } from './application.js';

export const ANALYTICS_RANGES = ['30d', '90d', '12m', 'all'] as const;
export const analyticsRangeSchema = z.enum(ANALYTICS_RANGES);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const analyticsQuerySchema = z.object({ range: analyticsRangeSchema.default('90d') });
export type AnalyticsQuery = z.input<typeof analyticsQuerySchema>;

/** Funnel stages: each counts applications that reached at least that stage. */
export const FUNNEL_STAGES = ['APPLIED', 'RESPONDED', 'INTERVIEW', 'OFFER'] as const;

const count = z.number().int().nonnegative();
/** 0–1, or null when there is nothing to divide by. */
const rate = z.number().min(0).max(1).nullable();
const rates = z.object({ response: rate, interview: rate, offer: rate });

export const analyticsSchema = z.object({
  range: analyticsRangeSchema,
  /** First local date included (null for all time). */
  from: z.iso.date().nullable(),
  to: z.iso.date(),
  totals: z.object({ applied: count, responded: count, interviewed: count, offers: count }),
  rates,
  /** Same rates for the preceding period of equal length (null for all time). */
  previousRates: rates.nullable(),
  /** Median days from applying to the first reply (assessment, interview, offer or rejection). */
  medianDaysToResponse: z.number().nullable(),
  responseTimesMeasured: count,
  funnel: z.array(z.object({ stage: z.enum(FUNNEL_STAGES), count })),
  weekly: z.array(z.object({ weekStart: z.iso.date(), applied: count })),
  sources: z.array(
    z.object({
      /** null = source not recorded */
      source: applicationSourceSchema.nullable(),
      applied: count,
      responded: count,
      interviewed: count,
      offers: count,
    }),
  ),
  /** Current status of every non-archived application (independent of the range). */
  pipeline: z.array(z.object({ status: applicationStatusSchema, count })),
  goal: z.object({
    /** Applications per week; 0 = no goal. */
    target: count,
    thisWeek: count,
    /** Consecutive weeks (including this one once reached) meeting the goal. */
    streak: count,
    weekStart: z.iso.date(),
  }),
});
export type Analytics = z.infer<typeof analyticsSchema>;
