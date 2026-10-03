import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthProviders,
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type User,
  type VerifyEmailInput,
  verifyEmailSchema,
} from '@apply-tracker/shared';
import type { CookieOptions, Request, Response } from 'express';
import { ApiZodBody, ZodBody } from '../common/zod/zod-body.decorator.js';
import type { Env } from '../config/env.js';
import {
  type CookieSettings,
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth-cookies.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, ClientInfo } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { GoogleOAuthService } from './google-oauth.service.js';

/** Stricter limit for endpoints attackers would brute-force or spam. */
const STRICT_LIMIT = { default: { limit: 10, ttl: 60_000 } };

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_VERIFIER_COOKIE = 'oauth_verifier';

export function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookies: CookieSettings;
  private readonly webUrl: string;

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOAuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookies = {
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      accessTtlSeconds: config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
    };
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Sign-in methods available on this server' })
  providers(): AuthProviders {
    return { google: this.google.enabled };
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and sign in' })
  @ApiZodBody(registerSchema)
  @ApiTooManyRequestsResponse()
  async register(
    @ZodBody(registerSchema) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<User> {
    const { user, tokens } = await this.auth.register(body, clientInfo(req));
    setAuthCookies(res, tokens, this.cookies);
    return user;
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiZodBody(loginSchema)
  @ApiTooManyRequestsResponse()
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<User> {
    const { user, tokens } = await this.auth.login(body, clientInfo(req));
    setAuthCookies(res, tokens, this.cookies);
    return user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rotate the refresh token cookie and issue a new access token' })
  @ApiNoContentResponse()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      const tokens = await this.auth.refresh(
        readCookie(req, REFRESH_COOKIE) ?? '',
        clientInfo(req),
      );
      setAuthCookies(res, tokens, this.cookies);
    } catch (error) {
      clearAuthCookies(res, this.cookies);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out of this device' })
  @ApiNoContentResponse()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE), undefined);
    clearAuthCookies(res, this.cookies);
  }

  @Throttle(STRICT_LIMIT)
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send the email verification link again' })
  @ApiNoContentResponse()
  resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.resendVerification(user.userId);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm an email address with the emailed token' })
  @ApiZodBody(verifyEmailSchema)
  @ApiNoContentResponse()
  verifyEmail(@ZodBody(verifyEmailSchema) body: VerifyEmailInput): Promise<void> {
    return this.auth.verifyEmail(body.token);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Email a password reset link (always succeeds)' })
  @ApiZodBody(forgotPasswordSchema)
  @ApiNoContentResponse()
  forgotPassword(@ZodBody(forgotPasswordSchema) body: ForgotPasswordInput): Promise<void> {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password with the emailed token; signs out all devices' })
  @ApiZodBody(resetPasswordSchema)
  @ApiNoContentResponse()
  async resetPassword(
    @ZodBody(resetPasswordSchema) body: ResetPasswordInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
    clearAuthCookies(res, this.cookies);
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Start Google sign-in (browser redirect)' })
  googleStart(@Res() res: Response): void {
    const { url, state, codeVerifier } = this.google.createAuthorizationUrl();
    res.cookie(OAUTH_STATE_COOKIE, state, this.oauthCookieOptions());
    res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, this.oauthCookieOptions());
    res.redirect(url.toString());
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google sign-in callback (browser redirect)' })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const expectedState = readCookie(req, OAUTH_STATE_COOKIE);
    const codeVerifier = readCookie(req, OAUTH_VERIFIER_COOKIE);
    const { maxAge: _maxAge, ...clearOptions } = this.oauthCookieOptions();
    res.clearCookie(OAUTH_STATE_COOKIE, clearOptions);
    res.clearCookie(OAUTH_VERIFIER_COOKIE, clearOptions);

    // `state` must match the cookie we set, otherwise the callback wasn't started by this browser.
    if (!code || !state || !codeVerifier || state !== expectedState) {
      return res.redirect(`${this.webUrl}/login?error=oauth_failed`);
    }

    try {
      const profile = await this.google.exchangeCode(code, codeVerifier);
      const tokens = await this.auth.loginWithGoogle(profile, clientInfo(req));
      setAuthCookies(res, tokens, this.cookies);
      res.redirect(`${this.webUrl}/dashboard`);
    } catch {
      res.redirect(`${this.webUrl}/login?error=oauth_failed`);
    }
  }

  private oauthCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookies.secure,
      // Lax: the cookie must be sent on the top-level redirect back from Google.
      sameSite: 'lax',
      path: '/api/v1/auth/google',
      maxAge: 10 * 60 * 1000,
    };
  }
}
