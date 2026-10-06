export const NOTIFICATIONS_QUEUE = 'notifications';
export const EMAIL_QUEUE = 'email';
export const AI_QUEUE = 'ai';

/** Job names on the notifications queue. */
export const NotificationJob = {
  /** One reminder became due ({ reminderId, dueAt }). */
  ReminderDue: 'reminder-due',
  /** Safety net: finds due reminders whose delayed job was lost. */
  SweepDueReminders: 'sweep-due-reminders',
  FollowUpSuggestions: 'follow-up-suggestions',
  UpcomingInterviews: 'upcoming-interviews',
  WeeklySummaries: 'weekly-summaries',
  /** Deletes "Try the demo" accounts older than 24 hours. */
  CleanupDemoAccounts: 'cleanup-demo-accounts',
} as const;

export const EmailJob = { Send: 'send' } as const;

export interface ReminderDueData {
  reminderId: string;
  /** The due time this job was scheduled for; stale jobs for rescheduled reminders are skipped. */
  dueAt: string;
}

/** Job names on the AI queue; each carries the id of the row to fill in. */
export const AiJob = {
  ResumeMatch: 'resume-match',
  CoverLetter: 'cover-letter',
} as const;

export interface AiJobData {
  id: string;
}
