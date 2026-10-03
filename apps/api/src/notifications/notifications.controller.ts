import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { NotificationList } from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiCookieAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Latest notifications and the unread count' })
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string): Promise<NotificationList> {
    return this.notifications.list(user.userId, unread === 'true');
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark every notification as read' })
  @ApiNoContentResponse()
  readAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user.userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiNoContentResponse()
  read(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.notifications.markRead(user.userId, id);
  }
}
