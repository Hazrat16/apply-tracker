import type {
  ApplicationSource,
  ApplicationStatus,
  InterviewOutcome,
  InterviewType,
  Priority,
  TagColor,
  WorkMode,
} from '@apply-tracker/shared';
import { APPLICATION_STATUSES } from '@apply-tracker/shared';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  WISHLIST: 'Wishlist',
  APPLIED: 'Applied',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  GHOSTED: 'Ghosted',
};

/** Accent colour per status (dot / badge). Literal class names so Tailwind can see them. */
export const STATUS_DOT: Record<ApplicationStatus, string> = {
  WISHLIST: 'bg-slate-400',
  APPLIED: 'bg-blue-500',
  ASSESSMENT: 'bg-violet-500',
  INTERVIEW: 'bg-amber-500',
  OFFER: 'bg-emerald-500',
  ACCEPTED: 'bg-green-600',
  REJECTED: 'bg-red-500',
  WITHDRAWN: 'bg-zinc-400',
  GHOSTED: 'bg-stone-400',
};

/** Statuses that end the process; shown after the active pipeline on the board. */
export const CLOSED_STATUSES: readonly ApplicationStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
];

export const BOARD_COLUMNS: readonly ApplicationStatus[] = APPLICATION_STATUSES;

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
};

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  COMPANY_WEBSITE: 'Company website',
  REFERRAL: 'Referral',
  RECRUITER: 'Recruiter',
  FACEBOOK: 'Facebook',
  JOB_BOARD: 'Job board',
  OTHER: 'Other',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREEN: 'Phone screen',
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  TAKE_HOME: 'Take-home',
  ONSITE: 'On-site',
  FINAL: 'Final round',
  OTHER: 'Other',
};

export const INTERVIEW_OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  PENDING: 'Pending',
  PASSED: 'Passed',
  FAILED: 'Not passed',
  CANCELLED: 'Cancelled',
};

export const TAG_STYLES: Record<TagColor, string> = {
  gray: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
};
