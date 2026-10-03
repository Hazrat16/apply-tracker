import type {
  ApplicationDetail,
  ApplicationSummary,
  Contact,
  Interview,
  Note,
  StatusChange,
  Tag,
  TagColor,
} from '@apply-tracker/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** Relations needed to render a card or table row. A function, because "upcoming" depends on now. */
export const summaryInclude = () =>
  ({
    company: { select: { id: true, name: true } },
    tags: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
    interviews: {
      where: { outcome: 'PENDING', scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
      take: 1,
      select: { scheduledAt: true },
    },
  }) satisfies Prisma.ApplicationInclude;

export const detailInclude = () =>
  ({
    ...summaryInclude(),
    notes: { orderBy: { createdAt: 'desc' } },
    contacts: { orderBy: { createdAt: 'asc' } },
    statusHistory: { orderBy: { changedAt: 'asc' } },
  }) satisfies Prisma.ApplicationInclude;

type SummaryRow = Prisma.ApplicationGetPayload<{ include: ReturnType<typeof summaryInclude> }>;
type DetailRow = Prisma.ApplicationGetPayload<{ include: ReturnType<typeof detailInclude> }> & {
  allInterviews: Prisma.InterviewGetPayload<object>[];
};

/** `@db.Date` columns come back as UTC midnight; the API exposes them as `YYYY-MM-DD`. */
export const toDateOnly = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
export const fromDateOnly = (value: string | null | undefined) =>
  value == null ? value : new Date(`${value}T00:00:00.000Z`);

export const toTag = (tag: { id: string; name: string; color: string }): Tag => ({
  id: tag.id,
  name: tag.name,
  color: tag.color as TagColor,
});

export function toSummary(row: SummaryRow): ApplicationSummary {
  return {
    id: row.id,
    roleTitle: row.roleTitle,
    status: row.status,
    position: row.position,
    company: row.company,
    jobUrl: row.jobUrl,
    location: row.location,
    workMode: row.workMode,
    source: row.source,
    priority: row.priority,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    currency: row.currency,
    appliedAt: toDateOnly(row.appliedAt),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    tags: row.tags.map(toTag),
    nextInterviewAt: row.interviews[0]?.scheduledAt.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const toNote = (note: Prisma.NoteGetPayload<object>): Note => ({
  id: note.id,
  body: note.body,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
});

export const toContact = (contact: Prisma.ContactGetPayload<object>): Contact => ({
  id: contact.id,
  name: contact.name,
  role: contact.role,
  email: contact.email,
  phone: contact.phone,
  linkedinUrl: contact.linkedinUrl,
  notes: contact.notes,
});

export const toInterview = (interview: Prisma.InterviewGetPayload<object>): Interview => ({
  id: interview.id,
  type: interview.type,
  scheduledAt: interview.scheduledAt.toISOString(),
  durationMinutes: interview.durationMinutes,
  location: interview.location,
  notes: interview.notes,
  outcome: interview.outcome,
});

const toStatusChange = (change: Prisma.StatusChangeGetPayload<object>): StatusChange => ({
  id: change.id,
  fromStatus: change.fromStatus,
  toStatus: change.toStatus,
  changedAt: change.changedAt.toISOString(),
});

export function toDetail(row: DetailRow): ApplicationDetail {
  return {
    ...toSummary(row),
    jobDescription: row.jobDescription,
    notes: row.notes.map(toNote),
    contacts: row.contacts.map(toContact),
    interviews: row.allInterviews.map(toInterview),
    statusHistory: row.statusHistory.map(toStatusChange),
  };
}
