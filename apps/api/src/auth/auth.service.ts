import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  RegisterInput,
  User as PublicUser,
} from '@apply-tracker/shared';
import type { Env } from '../config/env.js';
import { Prisma, VerificationTokenType } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { resetPasswordMessage, verifyEmailMessage } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { ClientInfo, IssuedTokens } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { VerificationTokenService } from './verification-token.service.js';

export interface AuthResult {
  user: PublicUser;
  tokens: IssuedTokens;
}

export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly verificationTokens: VerificationTokenService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  async register(input: RegisterInput, client: ClientInfo): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);

    let user;
    try {
      user = await this.prisma.user.create({
        data: { email: input.email, name: input.name, passwordHash, timeZone: input.timeZone },
        include: { accounts: { select: { provider: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    await this.sendVerificationEmail(user.id, user.email, user.name);
    const tokens = await this.sessions.create(user.id, client);
    return { user: UsersService.toPublic(user), tokens };
  }

  async login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    const valid = await this.passwords.verify(user?.passwordHash, input.password);
    if (!user || !valid) {
      // Same message either way, so the endpoint doesn't reveal which emails are registered.
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.sessions.create(user.id, client);
    return { user: await this.users.getPublicById(user.id), tokens };
  }

  /** Signs in (or signs up) with a verified identity from an OAuth provider such as Google. */
  async loginWithGoogle(profile: OAuthProfile, client: ClientInfo): Promise<IssuedTokens> {
    const provider = 'GOOGLE' as const;
    const linked = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId },
      },
    });

    let userId = linked?.userId;
    if (!userId) {
      if (!profile.emailVerified) {
        throw new UnauthorizedException('Google account email is not verified');
      }
      const email = profile.email.toLowerCase();
      const existing = await this.users.findByEmail(email);

      if (existing) {
        // Google has verified the address, so it's safe to link it to the existing account.
        await this.prisma.$transaction([
          this.prisma.account.create({
            data: { userId: existing.id, provider, providerAccountId: profile.providerAccountId },
          }),
          this.prisma.user.update({
            where: { id: existing.id },
            data: {
              emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
              avatarUrl: existing.avatarUrl ?? profile.avatarUrl,
              name: existing.name ?? profile.name,
            },
          }),
        ]);
        userId = existing.id;
      } else {
        const created = await this.prisma.user.create({
          data: {
            email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerifiedAt: new Date(),
            accounts: { create: { provider, providerAccountId: profile.providerAccountId } },
          },
        });
        userId = created.id;
      }
    }

    return this.sessions.create(userId, client);
  }

  refresh(refreshToken: string, client: ClientInfo): Promise<IssuedTokens> {
    return this.sessions.rotate(refreshToken, client);
  }

  async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    const id =
      sessionId ??
      (refreshToken ? await this.sessions.findSessionIdByRefreshToken(refreshToken) : undefined);
    if (id) await this.sessions.revoke(id);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.getById(userId);
    if (user.emailVerifiedAt) throw new BadRequestException('Email is already verified');
    await this.sendVerificationEmail(user.id, user.email, user.name);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.verificationTokens.consume(
      token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    if (!userId) throw new BadRequestException('This verification link is invalid or has expired');

    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = await this.verificationTokens.issue(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
    );
    const url = `${this.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.trySend(() => this.mail.send(resetPasswordMessage(user.email, user.name, url)));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.verificationTokens.consume(
      token,
      VerificationTokenType.PASSWORD_RESET,
    );
    if (!userId) throw new BadRequestException('This reset link is invalid or has expired');

    const passwordHash = await this.passwords.hash(password);
    await this.prisma.user.update({
      where: { id: userId },
      // Following the emailed link proves the user controls the address.
      data: { passwordHash, emailVerifiedAt: new Date() },
    });
    // Whoever knew the old password may have active sessions: sign out everywhere.
    await this.sessions.revokeAllForUser(userId);
  }

  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput) {
    const user = await this.users.getById(userId);
    if (user.passwordHash) {
      const valid =
        input.currentPassword !== undefined &&
        (await this.passwords.verify(user.passwordHash, input.currentPassword));
      if (!valid) throw new BadRequestException('Current password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.sessions.revokeAllForUser(userId, sessionId);
  }

  async deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
    const user = await this.users.getById(userId);
    if (user.passwordHash) {
      const valid =
        input.password !== undefined &&
        (await this.passwords.verify(user.passwordHash, input.password));
      if (!valid) throw new BadRequestException('Password is incorrect');
    }
    // Sessions, tokens and linked accounts are removed by cascading deletes.
    await this.prisma.user.delete({ where: { id: userId } });
  }

  private async sendVerificationEmail(userId: string, email: string, name: string | null) {
    const token = await this.verificationTokens.issue(
      userId,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    const url = `${this.webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.trySend(() => this.mail.send(verifyEmailMessage(email, name, url)));
  }

  /** Email delivery problems are logged, not surfaced: the user can always request a new email. */
  private async trySend(send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to send email');
    }
  }
}
