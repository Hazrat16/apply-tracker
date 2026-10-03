import { z } from 'zod';

export const APPLICATION_STATUSES = [
  'WISHLIST',
  'APPLIED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
] as const;

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE'] as const;

export const workModeSchema = z.enum(WORK_MODES);
export type WorkMode = z.infer<typeof workModeSchema>;
