import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload, ClientInfo, IssuedTokens } from './auth.types.js';
import { generateToken, hashToken } from './crypto.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A used refresh token presented again within this window is treated as a benign race
 * (e.g. two tabs refreshing at once) rather than theft.
 */
const REUSE_GRACE_MS = 10_000;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshTtlMs: number;
  private readonly sessionMaxAgeMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
    this.sessionMaxAgeMs = config.get('SESSION_MAX_AGE_DAYS', { infer: true }) * DAY_MS;
  }

  /** Starts a new session (sign-in on a device) and issues its first token pair. */
  async create(userId: string, client: ClientInfo): Promise<IssuedTokens> {
    const now = Date.now();
    const session = await this.prisma.session.create({
      data: {
        userId,
        userAgent: client.userAgent?.slice(0, 512),
        ipAddress: client.ipAddress,
        expiresAt: new Date(now + this.sessionMaxAgeMs),
      },
    });
    return this.issue(userId, session.id, session.expiresAt);
  }

  /**
   * Exchanges a refresh token for a new pair. Each refresh token works once;
   * replaying a used one revokes the whole session (token theft detection).
   */
  async rotate(refreshToken: string, client: ClientInfo): Promise<IssuedTokens> {
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { session: true },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    const { session } = stored;

    if (stored.usedAt) {
      if (now.getTime() - stored.usedAt.getTime() > REUSE_GRACE_MS) {
        this.logger.warn(`Refresh token reuse detected; revoking session ${session.id}`);
        await this.revoke(session.id);
      }
      throw new UnauthorizedException('Refresh token already used');
    }

    if (stored.expiresAt <= now || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException('Session expired');
    }

    // Conditional update makes concurrent rotations of the same token race-safe: only one wins.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: now },
    });
    if (count === 0) throw new UnauthorizedException('Refresh token already used');

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: now,
        ipAddress: client.ipAddress ?? session.ipAddress,
        userAgent: client.userAgent?.slice(0, 512) ?? session.userAgent,
      },
    });

    return this.issue(session.userId, session.id, session.expiresAt);
  }

  /** Session id that a refresh token belongs to, if any (used for logout). */
  async findSessionIdByRefreshToken(refreshToken: string): Promise<string | undefined> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { sessionId: true },
    });
    return stored?.sessionId;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Signs the user out everywhere, optionally keeping the current session. */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId && { id: { not: exceptSessionId } }) },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(
    userId: string,
    sessionId: string,
    sessionExpiresAt: Date,
  ): Promise<IssuedTokens> {
    const refreshToken = generateToken();
    const refreshExpiresAt = new Date(
      Math.min(Date.now() + this.refreshTtlMs, sessionExpiresAt.getTime()),
    );

    await this.prisma.refreshToken.create({
      data: { sessionId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
    });

    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken, refreshToken, sessionId, refreshExpiresAt };
  }
}
