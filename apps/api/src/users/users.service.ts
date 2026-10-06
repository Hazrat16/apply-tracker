import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  User as PublicUser,
} from '@apply-tracker/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const userWithAccounts = { accounts: { select: { provider: true } } } as const;

const preferenceFields = {
  emailReminders: true,
  weeklySummary: true,
  followUpAfterDays: true,
  timeZone: true,
  weeklyGoal: true,
} as const;

export type UserWithAccounts = Prisma.UserGetPayload<{ include: typeof userWithAccounts }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getById(id: string): Promise<UserWithAccounts> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userWithAccounts });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicById(id: string): Promise<PublicUser> {
    return UsersService.toPublic(await this.getById(id));
  }

  async updateProfile(id: string, data: { name: string }): Promise<PublicUser> {
    const user = await this.prisma.user.update({ where: { id }, data, include: userWithAccounts });
    return UsersService.toPublic(user);
  }

  async getPreferences(id: string): Promise<NotificationPreferences> {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: preferenceFields });
  }

  async updatePreferences(
    id: string,
    data: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    return this.prisma.user.update({ where: { id }, data, select: preferenceFields });
  }

  /** Maps a database user to the API representation — never exposes the password hash. */
  static toPublic(user: UserWithAccounts): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerifiedAt !== null,
      hasPassword: user.passwordHash !== null,
      providers: user.accounts.map((account) => account.provider),
      isDemo: user.demoExpiresAt !== null,
      demoExpiresAt: user.demoExpiresAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
