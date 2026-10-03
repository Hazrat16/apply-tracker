import { Global, Module } from '@nestjs/common';
import { EmailQueue } from './email-queue.service.js';
import { MailService } from './mail.service.js';

@Global()
@Module({
  providers: [MailService, EmailQueue],
  exports: [MailService, EmailQueue],
})
export class MailModule {}
