import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Analytics, analyticsQuerySchema } from '@apply-tracker/shared';
import type { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ApiZodQuery, ZodQuery } from '../common/zod/zod-query.decorator.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@ApiCookieAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Job search metrics: rates, funnel, weekly volume, sources, pipeline, goal',
  })
  @ApiZodQuery(analyticsQuerySchema)
  get(
    @CurrentUser() user: AuthUser,
    @ZodQuery(analyticsQuerySchema) query: z.output<typeof analyticsQuerySchema>,
  ): Promise<Analytics> {
    return this.analytics.get(user.userId, query.range);
  }
}
