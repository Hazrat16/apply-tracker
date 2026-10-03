import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CalendarEvent, CalendarFeed } from '@apply-tracker/shared';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildIcs, type IcsEvent } from './ics.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const DEFAULT_INTERVIEW_MINUTES = 60;
const REMINDER_MINUTES = 15;

const INTERVIEW_LABELS: Record<string, string> = {
  PHONE_SCREEN: 'Phone screen',
  TECHNICAL: 'Technical interview',
  BEHAVIORAL: 'Behavioral interview',
  TAKE_HOME: 'Take-home due',
  ONSITE: 'On-site interview',
  FINAL: 'Final interview',
  OTHER: 'Interview',
};

@Injectable()
export class CalendarService {
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  /** Interviews and reminders in a time range, for the in-app calendar. */
  async events(userId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const [interviews, reminders] = await this.load(userId, { from, to });
    const events: CalendarEvent[] = [
      ...interviews.map((interview) => ({
        id: `interview-${interview.id}`,
        kind: 'interview' as const,
        title: `${INTERVIEW_LABELS[interview.type]} — ${interview.application.company.name}`,
        start: interview.scheduledAt.toISOString(),
        end: new Date(
          interview.scheduledAt.getTime() +
            (interview.durationMinutes ?? DEFAULT_INTERVIEW_MINUTES) * MINUTE,
        ).toISOString(),
        location: interview.location,
        link: `/applications/${interview.application.id}`,
        completed: interview.outcome !== 'PENDING',
      })),
      ...reminders.map((reminder) => ({
        id: `reminder-${reminder.id}`,
        kind: 'reminder' as const,
        title: reminder.title,
        start: reminder.dueAt.toISOString(),
        end: new Date(reminder.dueAt.getTime() + REMINDER_MINUTES * MINUTE).toISOString(),
        location: null,
        link: reminder.applicationId ? `/applications/${reminder.applicationId}` : null,
        completed: reminder.completedAt !== null,
      })),
    ];
    return events.sort((a, b) => a.start.localeCompare(b.start));
  }

  /** iCalendar export: recent and upcoming interviews, plus open reminders. */
  async ics(userId: string, now = new Date()): Promise<string> {
    const [interviews, reminders] = await this.load(
      userId,
      { from: new Date(now.getTime() - 90 * DAY) },
      true,
    );
    const events: IcsEvent[] = [
      ...interviews.map((interview) => ({
        uid: `interview-${interview.id}@applytracker`,
        start: interview.scheduledAt,
        end: new Date(
          interview.scheduledAt.getTime() +
            (interview.durationMinutes ?? DEFAULT_INTERVIEW_MINUTES) * MINUTE,
        ),
        summary: `${INTERVIEW_LABELS[interview.type]} — ${interview.application.company.name}`,
        location: interview.location,
        description: [interview.application.roleTitle, interview.notes]
          .filter(Boolean)
          .join('\n\n'),
        url: `${this.webUrl}/applications/${interview.application.id}`,
        alarmMinutesBefore: 60,
      })),
      ...reminders.map((reminder) => ({
        uid: `reminder-${reminder.id}@applytracker`,
        start: reminder.dueAt,
        end: new Date(reminder.dueAt.getTime() + REMINDER_MINUTES * MINUTE),
        summary: `Reminder: ${reminder.title}`,
        description: reminder.note,
        url: reminder.applicationId
          ? `${this.webUrl}/applications/${reminder.applicationId}`
          : null,
      })),
    ];
    return buildIcs(events, { name: 'ApplyTracker', now });
  }

  // ── Private subscription feed ──

  async feed(userId: string): Promise<CalendarFeed> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarToken: true },
    });
    return { url: user.calendarToken ? this.feedUrl(user.calendarToken) : null };
  }

  /** Creates the feed URL, or replaces it (the old URL stops working). */
  async rotateFeed(userId: string): Promise<CalendarFeed> {
    const token = randomBytes(24).toString('base64url');
    await this.prisma.user.update({ where: { id: userId }, data: { calendarToken: token } });
    return { url: this.feedUrl(token) };
  }

  async disableFeed(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { calendarToken: null } });
  }

  async icsForToken(token: string): Promise<string> {
    const user = token
      ? await this.prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true } })
      : null;
    if (!user) throw new NotFoundException('Calendar not found');
    return this.ics(user.id);
  }

  private feedUrl(token: string) {
    // Served through the web app's /api proxy so it works wherever the app is reachable.
    return `${this.webUrl}/api/v1/calendar/feed/${token}.ics`;
  }

  private load(userId: string, range: { from: Date; to?: Date }, openRemindersOnly = false) {
    const time = { gte: range.from, ...(range.to && { lt: range.to }) };
    return Promise.all([
      this.prisma.interview.findMany({
        where: { scheduledAt: time, application: { userId, archivedAt: null } },
        include: {
          application: {
            select: { id: true, roleTitle: true, company: { select: { name: true } } },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.reminder.findMany({
        where: { userId, dueAt: time, ...(openRemindersOnly && { completedAt: null }) },
        orderBy: { dueAt: 'asc' },
      }),
    ]);
  }
}
