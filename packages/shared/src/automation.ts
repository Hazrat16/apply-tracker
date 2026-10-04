import { z } from 'zod';

// ── Reminders ────────────────────────────────────────────────────────────────

export const reminderSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  dueAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  application: z
    .object({ id: z.string(), roleTitle: z.string(), companyName: z.string() })
    .nullable(),
});
export type Reminder = z.infer<typeof reminderSchema>;

const reminderTitle = z.string().trim().min(1, 'Title is required').max(200);
const reminderNote = z
  .string()
  .trim()
  .max(2_000)
  .transform((value) => (value === '' ? null : value))
  .nullish();
const dueAt = z.iso.datetime({ offset: true, error: 'Choose a date and time' });

export const createReminderSchema = z.object({
  applicationId: z.uuid().nullish(),
  title: reminderTitle,
  note: reminderNote,
  dueAt,
});
export type CreateReminderInput = z.input<typeof createReminderSchema>;
export type CreateReminderData = z.output<typeof createReminderSchema>;

export const updateReminderSchema = z.object({
  title: reminderTitle.optional(),
  note: reminderNote,
  dueAt: dueAt.optional(),
  completed: z.boolean().optional(),
});
export type UpdateReminderInput = z.input<typeof updateReminderSchema>;
export type UpdateReminderData = z.output<typeof updateReminderSchema>;

export const REMINDER_FILTERS = ['open', 'done', 'all'] as const;
export const reminderListQuerySchema = z.object({
  status: z.enum(REMINDER_FILTERS).default('open'),
  applicationId: z.uuid().optional(),
});
export type ReminderListQuery = z.input<typeof reminderListQuerySchema>;
export type ReminderListParams = z.output<typeof reminderListQuerySchema>;

// ── Notifications ────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  'REMINDER_DUE',
  'FOLLOW_UP_SUGGESTED',
  'INTERVIEW_UPCOMING',
  'WEEKLY_SUMMARY',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  /** In-app path to open, e.g. `/applications/<id>`. */
  link: z.string().nullable(),
  applicationId: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;

// ── Preferences ──────────────────────────────────────────────────────────────

/** IANA time zone the runtime understands, e.g. "Europe/Berlin". */
export const timeZoneSchema = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');

export const FOLLOW_UP_DAY_OPTIONS = [3, 5, 7, 10, 14, 21] as const;

export const notificationPreferencesSchema = z.object({
  emailReminders: z.boolean(),
  weeklySummary: z.boolean(),
  /** Suggest a follow-up when an active application hasn't changed for this many days. */
  followUpAfterDays: z.number().int().min(1).max(60),
  timeZone: timeZoneSchema,
  /** Applications per week to aim for; 0 turns the goal off. */
  weeklyGoal: z.number().int().min(0).max(100),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesSchema = notificationPreferencesSchema.partial();
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

// ── Calendar ─────────────────────────────────────────────────────────────────

export const calendarEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['interview', 'reminder']),
  title: z.string(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  location: z.string().nullable(),
  /** In-app path for the related application or reminder. */
  link: z.string().nullable(),
  completed: z.boolean(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarRangeQuerySchema = z
  .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
  .refine((range) => new Date(range.from) < new Date(range.to), {
    path: ['to'],
    message: '`to` must be after `from`',
  })
  .refine(
    (range) => new Date(range.to).getTime() - new Date(range.from).getTime() <= 400 * 86_400_000,
    {
      path: ['to'],
      message: 'Range can be at most 400 days',
    },
  );
export type CalendarRangeQuery = z.infer<typeof calendarRangeQuerySchema>;

export const calendarFeedSchema = z.object({
  /** Secret subscription URL for calendar apps; null until created. */
  url: z.string().nullable(),
});
export type CalendarFeed = z.infer<typeof calendarFeedSchema>;
