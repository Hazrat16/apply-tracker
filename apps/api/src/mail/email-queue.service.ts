import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJob } from '../queue/queue.constants.js';
import type { MailMessage } from './mail.service.js';

/** Sends email in the background, with retries if the mail server is unavailable. */
@Injectable()
export class EmailQueue {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<MailMessage>) {}

  async enqueue(message: MailMessage, jobId?: string): Promise<void> {
    // A stable jobId makes enqueueing idempotent (BullMQ ignores duplicates).
    await this.queue.add(EmailJob.Send, message, jobId ? { jobId } : undefined);
  }
}
