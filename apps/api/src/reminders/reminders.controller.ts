import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateReminderData,
  createReminderSchema,
  type Reminder,
  type ReminderListParams,
  reminderListQuerySchema,
  type UpdateReminderData,
  updateReminderSchema,
} from '@apply-tracker/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import { ApiZodQuery, ZodQuery } from '../common/zod/zod-query.decorator.js';
import { RemindersService } from './reminders.service.js';

@ApiTags('reminders')
@ApiCookieAuth()
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  @ApiOperation({ summary: 'Reminders (open by default), optionally for one application' })
  @ApiZodQuery(reminderListQuerySchema)
  list(
    @CurrentUser() user: AuthUser,
    @ZodQuery(reminderListQuerySchema) query: ReminderListParams,
  ): Promise<Reminder[]> {
    return this.reminders.list(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a reminder (emails and notifies when due)' })
  @ApiZodBody(createReminderSchema)
  create(
    @CurrentUser() user: AuthUser,
    @ZodBody(createReminderSchema) body: CreateReminderData,
  ): Promise<Reminder> {
    return this.reminders.create(user.userId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit, reschedule, complete or reopen a reminder' })
  @ApiZodBody(updateReminderSchema)
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(updateReminderSchema) body: UpdateReminderData,
  ): Promise<Reminder> {
    return this.reminders.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a reminder' })
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.reminders.remove(user.userId, id);
  }
}
