import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { NotificationJob, NOTIFICATIONS_QUEUE } from '../queue/queue.constants.js';

/** Recurring jobs. Upserting is idempotent, so every worker instance can register them safely. */
const SCHEDULES = [
  {
    id: 'sweep-due-reminders',
    name: NotificationJob.SweepDueReminders,
    repeat: { every: 5 * 60_000 },
  },
  {
    id: 'upcoming-interviews',
    name: NotificationJob.UpcomingInterviews,
    repeat: { pattern: '5 * * * *' },
  },
  {
    id: 'weekly-summaries',
    name: NotificationJob.WeeklySummaries,
    repeat: { pattern: '0 * * * *' },
  },
  {
    id: 'follow-up-suggestions',
    name: NotificationJob.FollowUpSuggestions,
    repeat: { pattern: '15 */6 * * *' },
  },
] as const;

@Injectable()
export class JobSchedules implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobSchedules.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const schedule of SCHEDULES) {
      await this.queue.upsertJobScheduler(schedule.id, schedule.repeat, { name: schedule.name });
    }
    this.logger.log(`Registered ${SCHEDULES.length} recurring jobs`);
  }
}
