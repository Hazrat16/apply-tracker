import { Module } from '@nestjs/common';
import { AiJobExtractor } from './ai-job-extractor.js';
import { JobImportController } from './job-import.controller.js';
import { JobImportService } from './job-import.service.js';
import { SafePageFetcher } from './safe-fetch.js';

@Module({
  controllers: [JobImportController],
  providers: [JobImportService, SafePageFetcher, AiJobExtractor],
})
export class JobImportModule {}
