import { Module } from '@nestjs/common';
import { ApplicationItemsController } from './application-items.controller.js';
import { ApplicationItemsService } from './application-items.service.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  controllers: [ApplicationsController, ApplicationItemsController],
  providers: [ApplicationsService, ApplicationItemsService],
})
export class ApplicationsModule {}
