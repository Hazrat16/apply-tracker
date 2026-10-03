import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

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

export const APPLICATION_SOURCES = [
  'LINKEDIN',
  'INDEED',
  'COMPANY_WEBSITE',
  'REFERRAL',
  'RECRUITER',
  'FACEBOOK',
  'JOB_BOARD',
  'OTHER',
] as const;
export const applicationSourceSchema = z.enum(APPLICATION_SOURCES);
export type ApplicationSource = z.infer<typeof applicationSourceSchema>;

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const prioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof prioritySchema>;

export const INTERVIEW_TYPES = [
  'PHONE_SCREEN',
  'TECHNICAL',
  'BEHAVIORAL',
  'TAKE_HOME',
  'ONSITE',
  'FINAL',
  'OTHER',
] as const;
export const interviewTypeSchema = z.enum(INTERVIEW_TYPES);
export type InterviewType = z.infer<typeof interviewTypeSchema>;

export const INTERVIEW_OUTCOMES = ['PENDING', 'PASSED', 'FAILED', 'CANCELLED'] as const;
export const interviewOutcomeSchema = z.enum(INTERVIEW_OUTCOMES);
export type InterviewOutcome = z.infer<typeof interviewOutcomeSchema>;

export const TAG_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const;
export const tagColorSchema = z.enum(TAG_COLORS);
export type TagColor = z.infer<typeof tagColorSchema>;

// ── Field helpers ────────────────────────────────────────────────────────────

/** Optional free text: trimmed, and an empty string clears the value (`null`). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .transform((value) => (value === '' ? null : value))
    .nullish();

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => (value === '' ? null : value))
  .pipe(z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) URL' }).nullable())
  .nullish();

const money = z
  .number()
  .int('Must be a whole number')
  .nonnegative('Must be positive')
  .max(100_000_000)
  .nullish();

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

// ── Tags ─────────────────────────────────────────────────────────────────────

export const tagSchema = z.object({ id: z.string(), name: z.string(), color: tagColorSchema });
export type Tag = z.infer<typeof tagSchema>;

export const tagInputSchema = z.object({
  name: requiredText('Tag name', 30),
  color: tagColorSchema.default('gray'),
});
export type TagInput = z.input<typeof tagInputSchema>;
export type TagData = z.output<typeof tagInputSchema>;

// ── Applications ─────────────────────────────────────────────────────────────

/** Fields shared by create and update. No defaults here, so a PATCH never resets omitted fields. */
const applicationFields = z.object({
  companyName: requiredText('Company', 200),
  roleTitle: requiredText('Role', 200),
  status: applicationStatusSchema,
  jobUrl: optionalUrl,
  location: optionalText(200),
  workMode: workModeSchema.nullish(),
  source: applicationSourceSchema.nullish(),
  priority: prioritySchema,
  salaryMin: money,
  salaryMax: money,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
  /** Calendar date, `YYYY-MM-DD`. */
  appliedAt: z.iso.date().nullish(),
  jobDescription: optionalText(50_000),
  tagIds: z.array(z.uuid()).max(20, 'At most 20 tags'),
});

const salaryRangeIsValid = (data: { salaryMin?: number | null; salaryMax?: number | null }) =>
  data.salaryMin == null || data.salaryMax == null || data.salaryMin <= data.salaryMax;
const salaryRangeError = { path: ['salaryMax'], message: 'Must be at least the minimum salary' };

export const createApplicationSchema = applicationFields
  .extend({
    status: applicationStatusSchema.default('WISHLIST'),
    priority: prioritySchema.default('MEDIUM'),
    currency: applicationFields.shape.currency.default('USD'),
    tagIds: applicationFields.shape.tagIds.default([]),
  })
  .refine(salaryRangeIsValid, salaryRangeError);
export type CreateApplicationInput = z.input<typeof createApplicationSchema>;
export type CreateApplicationData = z.output<typeof createApplicationSchema>;

export const updateApplicationSchema = applicationFields
  .partial()
  .extend({ archived: z.boolean().optional() })
  .refine(salaryRangeIsValid, salaryRangeError);
export type UpdateApplicationInput = z.input<typeof updateApplicationSchema>;
export type UpdateApplicationData = z.output<typeof updateApplicationSchema>;

/** Drag-and-drop: the new column plus the neighbours the card was dropped between. */
export const moveApplicationSchema = z.object({
  status: applicationStatusSchema,
  /** Card directly above the drop position, if any. */
  beforeId: z.uuid().nullish(),
  /** Card directly below the drop position, if any. */
  afterId: z.uuid().nullish(),
});
export type MoveApplicationInput = z.infer<typeof moveApplicationSchema>;

export const APPLICATION_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'appliedAt',
  'company',
  'role',
  'status',
] as const;
export type ApplicationSortField = (typeof APPLICATION_SORT_FIELDS)[number];

/** Comma-separated query value, e.g. `?status=APPLIED,INTERVIEW`. */
const csvList = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
    z.array(item).optional(),
  );

export const applicationListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: csvList(applicationStatusSchema),
  workMode: csvList(workModeSchema),
  priority: csvList(prioritySchema),
  source: csvList(applicationSourceSchema),
  tagId: z.uuid().optional(),
  archived: z.stringbool().default(false),
  sort: z.enum(APPLICATION_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ApplicationListQuery = z.input<typeof applicationListQuerySchema>;
export type ApplicationListParams = z.output<typeof applicationListQuerySchema>;

export const applicationSummarySchema = z.object({
  id: z.string(),
  roleTitle: z.string(),
  status: applicationStatusSchema,
  position: z.number(),
  company: z.object({ id: z.string(), name: z.string() }),
  jobUrl: z.string().nullable(),
  location: z.string().nullable(),
  workMode: workModeSchema.nullable(),
  source: applicationSourceSchema.nullable(),
  priority: prioritySchema,
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  currency: z.string(),
  appliedAt: z.iso.date().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  tags: z.array(tagSchema),
  /** Soonest upcoming interview that hasn't been decided yet. */
  nextInterviewAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ApplicationSummary = z.infer<typeof applicationSummarySchema>;

// ── Notes, contacts, interviews ──────────────────────────────────────────────

export const noteSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Note = z.infer<typeof noteSchema>;
export const noteInputSchema = z.object({ body: requiredText('Note', 10_000) });
export type NoteInput = z.infer<typeof noteInputSchema>;

export const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Contact = z.infer<typeof contactSchema>;
export const contactInputSchema = z.object({
  name: requiredText('Name', 120),
  role: optionalText(120),
  email: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(z.email({ error: 'Enter a valid email address' }).nullable())
    .nullish(),
  phone: optionalText(40),
  linkedinUrl: optionalUrl,
  notes: optionalText(2_000),
});
export type ContactInput = z.input<typeof contactInputSchema>;
export type ContactData = z.output<typeof contactInputSchema>;

export const interviewSchema = z.object({
  id: z.string(),
  type: interviewTypeSchema,
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  outcome: interviewOutcomeSchema,
});
export type Interview = z.infer<typeof interviewSchema>;
export const interviewInputSchema = z.object({
  type: interviewTypeSchema,
  scheduledAt: z.iso.datetime({ offset: true, error: 'Choose a date and time' }),
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .nullish(),
  /** Address or meeting link. */
  location: optionalText(500),
  notes: optionalText(5_000),
  outcome: interviewOutcomeSchema.default('PENDING'),
});
export type InterviewInput = z.input<typeof interviewInputSchema>;
export type InterviewData = z.output<typeof interviewInputSchema>;

export const statusChangeSchema = z.object({
  id: z.string(),
  fromStatus: applicationStatusSchema.nullable(),
  toStatus: applicationStatusSchema,
  changedAt: z.iso.datetime(),
});
export type StatusChange = z.infer<typeof statusChangeSchema>;

export const applicationDetailSchema = applicationSummarySchema.extend({
  jobDescription: z.string().nullable(),
  notes: z.array(noteSchema),
  contacts: z.array(contactSchema),
  interviews: z.array(interviewSchema),
  statusHistory: z.array(statusChangeSchema),
});
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>;

// ── Collections ──────────────────────────────────────────────────────────────

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

export const applicationListSchema = paginatedSchema(applicationSummarySchema);
export type ApplicationList = z.infer<typeof applicationListSchema>;

export const companySchema = z.object({ id: z.string(), name: z.string() });
export type Company = z.infer<typeof companySchema>;

export const csvImportResultSchema = z.object({
  created: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type CsvImportResult = z.infer<typeof csvImportResultSchema>;
