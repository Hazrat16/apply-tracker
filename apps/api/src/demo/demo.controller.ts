import { Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@apply-tracker/shared';
import type { Request, Response } from 'express';
import { type CookieSettings, setAuthCookies } from '../auth/auth-cookies.js';
import { clientInfo } from '../auth/auth.controller.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { Env } from '../config/env.js';
import { DemoService } from './demo.service.js';

@ApiTags('auth')
@Controller('auth/demo')
export class DemoController {
  private readonly cookies: CookieSettings;

  constructor(
    private readonly demo: DemoService,
    config: ConfigService<Env, true>,
  ) {
    this.cookies = {
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      accessTtlSeconds: config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
    };
  }

  @Public()
  // Each demo creates an account with sample data: keep it to a handful per visitor.
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sign in to a new demo account with sample data (deleted after 24 hours)',
  })
  @ApiTooManyRequestsResponse()
  async start(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<User> {
    const { user, tokens } = await this.demo.start(clientInfo(req));
    setAuthCookies(res, tokens, this.cookies);
    return user;
  }
}
