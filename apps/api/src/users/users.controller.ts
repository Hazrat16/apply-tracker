import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type DeleteAccountInput,
  deleteAccountSchema,
  type NotificationPreferences,
  type SessionInfo,
  type UpdateNotificationPreferencesInput,
  updateNotificationPreferencesSchema,
  type UpdateProfileInput,
  updateProfileSchema,
  type User,
} from '@apply-tracker/shared';
import type { Response } from 'express';
import { clearAuthCookies } from '../auth/auth-cookies.js';
import { AuthService } from '../auth/auth.service.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UuidParam } from '../common/params/uuid-param.decorator.js';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import type { Env } from '../config/env.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users/me')
export class UsersController {
  private readonly secureCookies: boolean;
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
    this.accessTtlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  @Get()
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.users.getPublicById(user.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile' })
  @ApiZodBody(updateProfileSchema)
  update(
    @CurrentUser() user: AuthUser,
    @ZodBody(updateProfileSchema) body: UpdateProfileInput,
  ): Promise<User> {
    return this.users.updateProfile(user.userId, body);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Notification preferences' })
  preferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferences> {
    return this.users.getPreferences(user.userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiZodBody(updateNotificationPreferencesSchema)
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @ZodBody(updateNotificationPreferencesSchema) body: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    return this.users.updatePreferences(user.userId, body);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change (or set) password; signs out other devices' })
  @ApiZodBody(changePasswordSchema)
  @ApiNoContentResponse()
  changePassword(
    @CurrentUser() user: AuthUser,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
  ): Promise<void> {
    return this.auth.changePassword(user.userId, user.sessionId, body);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Devices and browsers signed in to this account' })
  listSessions(@CurrentUser() user: AuthUser): Promise<SessionInfo[]> {
    return this.sessions.listActive(user.userId, user.sessionId);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out every other device' })
  @ApiNoContentResponse()
  async revokeOtherSessions(@CurrentUser() user: AuthUser): Promise<void> {
    await this.sessions.revokeAllForUser(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out one device (use logout for the current one)' })
  @ApiNoContentResponse()
  async revokeSession(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    if (id === user.sessionId) {
      throw new BadRequestException('Use “Sign out” to end the session you are using');
    }
    if (!(await this.sessions.revokeForUser(user.userId, id))) {
      throw new NotFoundException('Session not found');
    }
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete the account and all its data' })
  @ApiZodBody(deleteAccountSchema)
  @ApiNoContentResponse()
  async delete(
    @CurrentUser() user: AuthUser,
    @ZodBody(deleteAccountSchema) body: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(user.userId, body);
    clearAuthCookies(res, {
      secure: this.secureCookies,
      accessTtlSeconds: this.accessTtlSeconds,
    });
  }
}
