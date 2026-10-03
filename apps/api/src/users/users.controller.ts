import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type DeleteAccountInput,
  deleteAccountSchema,
  type NotificationPreferences,
  type UpdateNotificationPreferencesInput,
  updateNotificationPreferencesSchema,
  type UpdateProfileInput,
  updateProfileSchema,
  type User,
} from '@apply-tracker/shared';
import type { Response } from 'express';
import { clearAuthCookies } from '../auth/auth-cookies.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
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
