import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (cookies are already SameSite): browsers always send `Origin`
 * on cross-origin writes, so reject state-changing requests from origins we don't trust.
 * Requests without an Origin header (curl, server-to-server) are not browser CSRF and pass.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor(config: ConfigService<Env, true>) {
    this.allowed = new Set([
      ...config.get('CORS_ORIGINS', { infer: true }),
      new URL(config.get('WEB_URL', { infer: true })).origin,
    ]);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin && !this.allowed.has(origin)) {
      throw new ForbiddenException('Origin not allowed');
    }
    return true;
  }
}
