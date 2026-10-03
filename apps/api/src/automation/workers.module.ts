import { Module } from '@nestjs/common';
import { AutomationModule } from './automation.module.js';
import { EmailProcessor } from './email.processor.js';
import { JobSchedules } from './job-schedules.js';
import { NotificationsProcessor } from './notifications.processor.js';

/** Queue consumers and recurring schedules; loaded only where RUN_WORKERS is enabled. */
@Module({
  imports: [AutomationModule],
  providers: [NotificationsProcessor, EmailProcessor, JobSchedules],
})
export class WorkersModule {}
