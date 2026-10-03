import { Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import {
  type CalendarEvent,
  type CalendarFeed,
  type CalendarRangeQuery,
  calendarRangeQuerySchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ApiZodQuery, ZodQuery } from '../common/zod/zod-query.decorator.js';
import { CalendarService } from './calendar.service.js';

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('events')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Interviews and reminders between two dates' })
  @ApiZodQuery(calendarRangeQuerySchema)
  events(
    @CurrentUser() user: AuthUser,
    @ZodQuery(calendarRangeQuerySchema) query: CalendarRangeQuery,
  ): Promise<CalendarEvent[]> {
    return this.calendar.events(user.userId, new Date(query.from), new Date(query.to));
  }

  @Get('applytracker.ics')
  @ApiCookieAuth()
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="applytracker.ics"')
  @ApiOperation({ summary: 'Download interviews and reminders as an .ics file' })
  @ApiProduces('text/calendar')
  download(@CurrentUser() user: AuthUser): Promise<string> {
    return this.calendar.ics(user.userId);
  }

  @Get('feed')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Private calendar subscription URL (null when not created)' })
  feed(@CurrentUser() user: AuthUser): Promise<CalendarFeed> {
    return this.calendar.feed(user.userId);
  }

  @Post('feed')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or replace the subscription URL (the old one stops working)' })
  rotateFeed(@CurrentUser() user: AuthUser): Promise<CalendarFeed> {
    return this.calendar.rotateFeed(user.userId);
  }

  @Delete('feed')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Turn off the subscription URL' })
  @ApiNoContentResponse()
  disableFeed(@CurrentUser() user: AuthUser): Promise<void> {
    return this.calendar.disableFeed(user.userId);
  }

  /** Fetched by calendar apps, which can't send cookies; the unguessable token is the credential. */
  @Public()
  @Get('feed/:token.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Subscription feed for calendar apps (secret URL)' })
  @ApiProduces('text/calendar')
  feedIcs(@Param('token') token: string): Promise<string> {
    return this.calendar.icsForToken(token);
  }
}
