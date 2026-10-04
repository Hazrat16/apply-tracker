import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AiStatus,
  type CoverLetter,
  type CreateCoverLetterData,
  createCoverLetterSchema,
  type CreateResumeMatchInput,
  createResumeMatchSchema,
  type ResumeMatch,
  type UpdateCoverLetterInput,
  updateCoverLetterSchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { AiService } from './ai.service.js';

/** Each request may be a paid or slow model call. */
const AI_REQUEST_LIMIT = { default: { ttl: 60 * 60_000, limit: 30 } };

@ApiTags('ai')
@ApiCookieAuth()
@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('ai/status')
  @ApiOperation({ summary: 'Which engine runs resume matching and cover letters' })
  status(): AiStatus {
    return this.ai.status();
  }

  @Get('applications/:id/matches')
  @ApiOperation({ summary: 'Resume match results for an application' })
  listMatches(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<ResumeMatch[]> {
    return this.ai.listMatches(user.userId, id);
  }

  @Post('applications/:id/matches')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(AI_REQUEST_LIMIT)
  @ApiOperation({ summary: 'Score a resume against the job description (runs in the background)' })
  @ApiZodBody(createResumeMatchSchema)
  requestMatch(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(createResumeMatchSchema) body: CreateResumeMatchInput,
  ): Promise<ResumeMatch> {
    return this.ai.requestMatch(user.userId, id, body.resumeId);
  }

  @Get('applications/:id/cover-letters')
  @ApiOperation({ summary: 'Cover letter drafts for an application, newest first' })
  listCoverLetters(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<CoverLetter[]> {
    return this.ai.listCoverLetters(user.userId, id);
  }

  @Post('applications/:id/cover-letters')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(AI_REQUEST_LIMIT)
  @ApiOperation({ summary: 'Draft a cover letter from a resume (runs in the background)' })
  @ApiZodBody(createCoverLetterSchema)
  requestCoverLetter(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(createCoverLetterSchema) body: CreateCoverLetterData,
  ): Promise<CoverLetter> {
    return this.ai.requestCoverLetter(user.userId, id, body);
  }

  @Patch('cover-letters/:id')
  @ApiOperation({ summary: 'Save edits to a finished cover letter' })
  @ApiZodBody(updateCoverLetterSchema)
  updateCoverLetter(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(updateCoverLetterSchema) body: UpdateCoverLetterInput,
  ): Promise<CoverLetter> {
    return this.ai.updateCoverLetter(user.userId, id, body);
  }

  @Delete('cover-letters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a cover letter draft' })
  @ApiNoContentResponse()
  removeCoverLetter(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.ai.removeCoverLetter(user.userId, id);
  }
}
