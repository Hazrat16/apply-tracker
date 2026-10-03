import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type JobImportCapabilities,
  type JobLinkInput,
  jobLinkInputSchema,
  type JobPreview,
  type JobTextInput,
  jobTextInputSchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { JobImportService } from './job-import.service.js';

/** Each preview fetches an external page and may call an AI model, so it's limited more tightly. */
const PREVIEW_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('job-imports')
@ApiCookieAuth()
@Controller('job-imports')
export class JobImportController {
  constructor(private readonly jobImport: JobImportService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Which import methods this server supports' })
  capabilities(): JobImportCapabilities {
    return this.jobImport.capabilities();
  }

  @Post('preview-link')
  @HttpCode(HttpStatus.OK)
  @Throttle(PREVIEW_LIMIT)
  @ApiOperation({
    summary: 'Read a job link (LinkedIn, Indeed, company sites…) into a draft application',
  })
  @ApiZodBody(jobLinkInputSchema)
  previewLink(
    @CurrentUser() user: AuthUser,
    @ZodBody(jobLinkInputSchema) body: JobLinkInput,
  ): Promise<JobPreview> {
    return this.jobImport.previewLink(user.userId, body.url);
  }

  @Post('preview-text')
  @HttpCode(HttpStatus.OK)
  @Throttle(PREVIEW_LIMIT)
  @ApiOperation({ summary: 'Turn pasted job text into a draft application (needs AI enabled)' })
  @ApiZodBody(jobTextInputSchema)
  previewText(
    @CurrentUser() user: AuthUser,
    @ZodBody(jobTextInputSchema) body: JobTextInput,
  ): Promise<JobPreview> {
    return this.jobImport.previewText(user.userId, body);
  }
}
