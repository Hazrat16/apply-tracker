import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  NotificationJob,
  NOTIFICATIONS_QUEUE,
  type ReminderDueData,
} from '../queue/queue.constants.js';
import { DemoService } from '../demo/demo.service.js';
import { AutomationService } from './automation.service.js';

/** Consumes the notifications queue: due reminders and the scheduled scans. */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly automation: AutomationService,
    private readonly demo: DemoService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case NotificationJob.ReminderDue:
        return this.automation.reminderDue(job.data as ReminderDueData);
      case NotificationJob.SweepDueReminders:
        return this.report(job, await this.automation.sweepDueReminders());
      case NotificationJob.FollowUpSuggestions:
        return this.report(job, await this.automation.suggestFollowUps());
      case NotificationJob.UpcomingInterviews:
        return this.report(job, await this.automation.notifyUpcomingInterviews());
      case NotificationJob.WeeklySummaries:
        return this.report(job, await this.automation.sendWeeklySummaries());
      case NotificationJob.CleanupDemoAccounts:
        return this.report(job, await this.demo.cleanupExpired());
      default:
        throw new Error(`Unknown job "${job.name}"`);
    }
  }

  private report(job: Job, count: number): number {
    if (count > 0) this.logger.log(`${job.name}: ${count}`);
    return count;
  }
}
