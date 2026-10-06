import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE, readCookie } from '../auth-cookies.js';
import type { AccessTokenPayload, AuthenticatedRequest } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SessionService } from '../session.service.js';

/**
 * Global guard: every route requires a valid access token for a session that is still active,
 * unless marked `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = readCookie(req, ACCESS_COOKIE) ?? this.bearerToken(req);
    if (!token) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    // A signed-out session ends at once, not when its short-lived access token expires.
    if (!(await this.sessions.isActive(payload.sid))) throw new UnauthorizedException();
    (req as AuthenticatedRequest).user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }

  private bearerToken(req: Request): string | undefined {
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}
