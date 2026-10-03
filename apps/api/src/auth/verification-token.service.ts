import { Injectable } from '@nestjs/common';
import { VerificationTokenType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateToken, hashToken } from './crypto.util.js';

const TTL_MS: Record<VerificationTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/** Single-use, expiring tokens delivered by email (verify email, reset password). */
@Injectable()
export class VerificationTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token, invalidating any earlier unused token of the same type. Returns the raw token. */
  async issue(userId: string, type: VerificationTokenType): Promise<string> {
    const token = generateToken();
    await this.prisma.$transaction([
      this.prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } }),
      this.prisma.verificationToken.create({
        data: {
          userId,
          type,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /** Marks the token used and returns its user id, or `null` if invalid, expired or already used. */
  async consume(token: string, type: VerificationTokenType): Promise<string | null> {
    const stored = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.type !== type || stored.usedAt || stored.expiresAt <= new Date()) {
      return null;
    }

    const { count } = await this.prisma.verificationToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1 ? stored.userId : null;
  }
}
