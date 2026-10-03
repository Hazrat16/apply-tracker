import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateReminderData,
  Reminder,
  ReminderListParams,
  UpdateReminderData,
} from '@apply-tracker/shared';
import type { Queue } from 'bullmq';
import { ApplicationsService } from '../applications/applications.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationJob,
  NOTIFICATIONS_QUEUE,
  type ReminderDueData,
} from '../queue/queue.constants.js';

const include = {
  application: { select: { id: true, roleTitle: true, company: { select: { name: true } } } },
} as const;

type ReminderRow = Prisma.ReminderGetPayload<{ include: typeof include }>;

export const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  title: row.title,
  note: row.note,
  dueAt: row.dueAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
  application: row.application
    ? {
        id: row.application.id,
        roleTitle: row.application.roleTitle,
        companyName: row.application.company.name,
      }
    : null,
});

/** Job id for a reminder at a given due time: rescheduling creates a new job, duplicates are ignored. */
export const reminderJobId = (id: string, dueAt: Date) => `reminder-${id}-${dueAt.getTime()}`;

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async list(userId: string, params: ReminderListParams): Promise<Reminder[]> {
    const rows = await this.prisma.reminder.findMany({
      where: {
        userId,
        ...(params.applicationId && { applicationId: params.applicationId }),
        ...(params.status === 'open' && { completedAt: null }),
        ...(params.status === 'done' && { completedAt: { not: null } }),
      },
      include,
      orderBy: params.status === 'done' ? { completedAt: 'desc' } : { dueAt: 'asc' },
      take: 200,
    });
    return rows.map(toReminder);
  }

  async create(userId: string, data: CreateReminderData): Promise<Reminder> {
    if (data.applicationId) await this.applications.assertOwned(userId, data.applicationId);
    const row = await this.prisma.reminder.create({
      data: {
        userId,
        applicationId: data.applicationId ?? null,
        title: data.title,
        note: data.note ?? null,
        dueAt: new Date(data.dueAt),
      },
      include,
    });
    await this.schedule(row);
    return toReminder(row);
  }

  async update(userId: string, id: string, data: UpdateReminderData): Promise<Reminder> {
    const current = await this.prisma.reminder.findFirst({ where: { id, userId } });
    if (!current) throw new NotFoundException('Reminder not found');

    const dueAt = data.dueAt ? new Date(data.dueAt) : undefined;
    const rescheduled = dueAt !== undefined && dueAt.getTime() !== current.dueAt.getTime();
    const row = await this.prisma.reminder.update({
      where: { id },
      data: {
        title: data.title,
        note: data.note,
        ...(rescheduled && { dueAt, notifiedAt: null }),
        ...(data.completed !== undefined && { completedAt: data.completed ? new Date() : null }),
      },
      include,
    });
    if (rescheduled || data.completed === false) await this.schedule(row);
    return toReminder(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    // Its delayed job may still fire; the worker finds no reminder and does nothing.
    const { count } = await this.prisma.reminder.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Reminder not found');
  }

  /** Queues the "due" job, delayed until the reminder's due time. */
  async schedule(reminder: {
    id: string;
    dueAt: Date;
    completedAt: Date | null;
    notifiedAt: Date | null;
  }) {
    if (reminder.completedAt || reminder.notifiedAt) return;
    const data: ReminderDueData = { reminderId: reminder.id, dueAt: reminder.dueAt.toISOString() };
    await this.queue.add(NotificationJob.ReminderDue, data, {
      jobId: reminderJobId(reminder.id, reminder.dueAt),
      delay: Math.max(0, reminder.dueAt.getTime() - Date.now()),
    });
  }
}
