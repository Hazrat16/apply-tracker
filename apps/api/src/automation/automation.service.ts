import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Env } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { EmailQueue } from '../mail/email-queue.service.js';
import {
  interviewSoonMessage,
  reminderDueMessage,
  type WeeklySummary,
  weeklySummaryMessage,
} from '../mail/templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationJob,
  NOTIFICATIONS_QUEUE,
  type ReminderDueData,
} from '../queue/queue.constants.js';
import { reminderJobId } from '../reminders/reminders.service.js';
import { formatInZone, localTime } from './local-time.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Stages where a polite follow-up can help. */
const FOLLOW_UP_STATUSES = ['APPLIED', 'ASSESSMENT', 'INTERVIEW'] as const;

const INTERVIEW_LABELS: Record<string, string> = {
  PHONE_SCREEN: 'Phone screen',
  TECHNICAL: 'Technical interview',
  BEHAVIORAL: 'Behavioral interview',
  TAKE_HOME: 'Take-home deadline',
  ONSITE: 'On-site interview',
  FINAL: 'Final interview',
  OTHER: 'Interview',
};

/** Weekly summaries go out on Monday at 08:00 in each user's time zone. */
const SUMMARY_WEEKDAY = 1;
const SUMMARY_HOUR = 8;

/**
 * The work behind every background job. Each method takes `now` so it can be tested
 * deterministically, and is idempotent: running it twice never notifies twice.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailQueue,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  /** A reminder's delayed job fired. Returns whether a notification was sent. */
  async reminderDue({ reminderId, dueAt }: ReminderDueData, now = new Date()): Promise<boolean> {
    // Claim it atomically; skips deleted, completed, rescheduled or already-notified reminders.
    const { count } = await this.prisma.reminder.updateMany({
      where: { id: reminderId, dueAt: new Date(dueAt), notifiedAt: null, completedAt: null },
      data: { notifiedAt: now },
    });
    if (count === 0) return false;

    const reminder = await this.prisma.reminder.findUniqueOrThrow({
      where: { id: reminderId },
      include: {
        user: { select: { email: true, name: true, emailReminders: true } },
        application: { select: { id: true, roleTitle: true, company: { select: { name: true } } } },
      },
    });
    const context = reminder.application
      ? `${reminder.application.roleTitle} at ${reminder.application.company.name}`
      : null;
    const link = reminder.application ? `/applications/${reminder.application.id}` : '/calendar';

    await this.notifications.create({
      userId: reminder.userId,
      type: 'REMINDER_DUE',
      title: reminder.title,
      body: reminder.note ?? context,
      link,
      applicationId: reminder.applicationId,
      dedupeKey: `reminder:${reminder.id}:${reminder.dueAt.getTime()}`,
    });
    if (reminder.user.emailReminders) {
      await this.email.enqueue(
        reminderDueMessage(
          reminder.user.email,
          reminder.user.name,
          { title: reminder.title, note: reminder.note, context },
          { open: this.url(link), settings: this.url('/settings') },
        ),
        `reminder-email-${reminder.id}-${reminder.dueAt.getTime()}`,
      );
    }
    return true;
  }

  /** Safety net for delayed jobs lost from Redis: re-queues due reminders that weren't sent. */
  async sweepDueReminders(now = new Date()): Promise<number> {
    const due = await this.prisma.reminder.findMany({
      where: { dueAt: { lte: now }, notifiedAt: null, completedAt: null },
      select: { id: true, dueAt: true },
      take: 500,
    });
    for (const reminder of due) {
      const data: ReminderDueData = {
        reminderId: reminder.id,
        dueAt: reminder.dueAt.toISOString(),
      };
      // Same job id as when scheduled, so an existing job isn't duplicated.
      await this.queue.add(NotificationJob.ReminderDue, data, {
        jobId: reminderJobId(reminder.id, reminder.dueAt),
      });
    }
    return due.length;
  }

  /** In-app suggestions for active applications that have gone quiet. */
  async suggestFollowUps(now = new Date()): Promise<number> {
    const stale = await this.prisma.$queryRaw<
      {
        id: string;
        user_id: string;
        role_title: string;
        company: string;
        updated_at: Date;
        days: number;
      }[]
    >`
      SELECT a.id, a.user_id, a.role_title, c.name AS company, a.updated_at, u.follow_up_after_days AS days
      FROM applications a
      JOIN users u ON u.id = a.user_id
      JOIN companies c ON c.id = a.company_id
      WHERE a.archived_at IS NULL
        AND a.status::text IN (${Prisma.join([...FOLLOW_UP_STATUSES])})
        AND a.updated_at < ${now}::timestamptz - make_interval(days => u.follow_up_after_days)
        AND NOT EXISTS (
          SELECT 1 FROM reminders r WHERE r.application_id = a.id AND r.completed_at IS NULL
        )
      ORDER BY a.updated_at
      LIMIT 1000`;

    let created = 0;
    for (const app of stale) {
      const quietDays = Math.floor((now.getTime() - app.updated_at.getTime()) / DAY);
      const isNew = await this.notifications.create({
        userId: app.user_id,
        type: 'FOLLOW_UP_SUGGESTED',
        title: `Follow up with ${app.company}?`,
        body: `No updates on “${app.role_title}” for ${quietDays} days. A short check-in can move things along.`,
        link: `/applications/${app.id}`,
        applicationId: app.id,
        // Re-suggested only after the application changes and goes quiet again.
        dedupeKey: `follow-up:${app.id}:${app.updated_at.getTime()}`,
      });
      if (isNew) created++;
    }
    return created;
  }

  /** Heads-up (in-app and email) for interviews in the next 24 hours. */
  async notifyUpcomingInterviews(now = new Date()): Promise<number> {
    const interviews = await this.prisma.interview.findMany({
      where: {
        outcome: 'PENDING',
        scheduledAt: { gt: now, lte: new Date(now.getTime() + DAY) },
        application: { archivedAt: null },
      },
      include: {
        application: {
          select: {
            id: true,
            roleTitle: true,
            userId: true,
            company: { select: { name: true } },
            user: { select: { email: true, name: true, emailReminders: true, timeZone: true } },
          },
        },
      },
    });

    let created = 0;
    for (const interview of interviews) {
      const app = interview.application;
      const label = INTERVIEW_LABELS[interview.type] ?? 'Interview';
      const when = formatInZone(interview.scheduledAt, app.user.timeZone);
      const link = `/applications/${app.id}`;
      const isNew = await this.notifications.create({
        userId: app.userId,
        type: 'INTERVIEW_UPCOMING',
        title: `${label} with ${app.company.name}`,
        body: `${app.roleTitle} — ${when}${interview.location ? ` · ${interview.location}` : ''}`,
        link,
        applicationId: app.id,
        dedupeKey: `interview:${interview.id}:${interview.scheduledAt.getTime()}`,
      });
      if (!isNew) continue;
      created++;
      if (app.user.emailReminders) {
        await this.email.enqueue(
          interviewSoonMessage(
            app.user.email,
            app.user.name,
            {
              label,
              when,
              location: interview.location,
              company: app.company.name,
              role: app.roleTitle,
            },
            { open: this.url(link), settings: this.url('/settings') },
          ),
          `interview-email-${interview.id}-${interview.scheduledAt.getTime()}`,
        );
      }
    }
    return created;
  }

  /** Runs hourly; sends each opted-in user's summary in their Monday-morning hour. */
  async sendWeeklySummaries(now = new Date()): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { weeklySummary: true },
      select: { id: true, email: true, name: true, timeZone: true },
    });

    let sent = 0;
    for (const user of users) {
      const local = localTime(now, user.timeZone);
      if (local.weekday !== SUMMARY_WEEKDAY || local.hour !== SUMMARY_HOUR) continue;

      const summary = await this.weeklySummary(user.id, user.timeZone, now);
      const nothingToSay =
        summary.added + summary.interviews + summary.offers + summary.rejections === 0 &&
        summary.upcoming.length + summary.overdueReminders + summary.followUpsDue === 0;
      if (nothingToSay) continue;

      const isNew = await this.notifications.create({
        userId: user.id,
        type: 'WEEKLY_SUMMARY',
        title: 'Your week in review',
        body: `${summary.added} new · ${summary.interviews} to interview · ${summary.offers} offers · ${summary.upcoming.length} interviews coming up`,
        link: '/board',
        dedupeKey: `weekly:${local.date}`,
      });
      if (!isNew) continue;
      await this.email.enqueue(
        weeklySummaryMessage(user.email, user.name, summary, {
          open: this.url('/board'),
          settings: this.url('/settings'),
        }),
        `weekly-email-${user.id}-${local.date}`,
      );
      sent++;
    }
    return sent;
  }

  async weeklySummary(userId: string, timeZone: string, now: Date): Promise<WeeklySummary> {
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const nextWeek = new Date(now.getTime() + 7 * DAY);
    const movedTo = (status: 'INTERVIEW' | 'OFFER' | 'REJECTED') =>
      this.prisma.statusChange.count({
        where: {
          application: { userId },
          toStatus: status,
          fromStatus: { not: null },
          changedAt: { gte: weekAgo },
        },
      });

    const [added, interviews, offers, rejections, upcoming, overdueReminders, followUpsDue] =
      await Promise.all([
        this.prisma.application.count({ where: { userId, createdAt: { gte: weekAgo } } }),
        movedTo('INTERVIEW'),
        movedTo('OFFER'),
        movedTo('REJECTED'),
        this.prisma.interview.findMany({
          where: {
            application: { userId, archivedAt: null },
            outcome: 'PENDING',
            scheduledAt: { gt: now, lte: nextWeek },
          },
          include: {
            application: { select: { roleTitle: true, company: { select: { name: true } } } },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
        }),
        this.prisma.reminder.count({ where: { userId, completedAt: null, dueAt: { lt: now } } }),
        this.prisma.notification.count({
          where: { userId, type: 'FOLLOW_UP_SUGGESTED', readAt: null },
        }),
      ]);

    return {
      added,
      interviews,
      offers,
      rejections,
      upcoming: upcoming.map((interview) => ({
        when: formatInZone(interview.scheduledAt, timeZone),
        label: `${INTERVIEW_LABELS[interview.type] ?? 'Interview'} — ${interview.application.roleTitle} at ${interview.application.company.name}`,
      })),
      overdueReminders,
      followUpsDue,
    };
  }

  private url(path: string) {
    return `${this.webUrl}${path}`;
  }
}
