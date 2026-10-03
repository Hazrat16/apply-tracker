import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MailService, type MailMessage } from '../mail/mail.service.js';
import { EMAIL_QUEUE } from '../queue/queue.constants.js';

/** Delivers queued email; failures are retried with exponential backoff by BullMQ. */
@Processor(EMAIL_QUEUE, { concurrency: 2 })
export class EmailProcessor extends WorkerHost {
  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<MailMessage>): Promise<void> {
    await this.mail.send(job.data);
  }
}
