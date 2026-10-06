import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthResult } from '../auth/auth.service.js';
import type { ClientInfo } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { UsersService } from '../users/users.service.js';
import type { Env, StorageDriverName } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { DEMO_NAME, seedDemoData } from './demo-data.js';

const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * "Try the demo": a private, throwaway account with sample data for each visitor, so nobody
 * shares (or vandalises) one demo login. Accounts are deleted after 24 hours.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly storage: StorageService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('DEMO_ENABLED', { infer: true });
  }

  async start(client: ClientInfo): Promise<AuthResult> {
    if (!this.enabled) throw new NotFoundException('The demo is not available on this server');

    const user = await this.prisma.user.create({
      data: {
        // `.invalid` is reserved and can never receive mail.
        email: `demo-${randomUUID()}@demo.invalid`,
        name: DEMO_NAME,
        emailVerifiedAt: new Date(),
        demoExpiresAt: new Date(Date.now() + DEMO_LIFETIME_MS),
        // No email for throwaway addresses; in-app notifications still work.
        emailReminders: false,
        weeklySummary: false,
        followUpAfterDays: 5,
      },
    });
    try {
      await seedDemoData(this.prisma, user.id, {
        storeFile: (key, data, type) => this.storage.put(key, data, type),
      });
    } catch (error) {
      await this.removeUsers([user.id]);
      throw error;
    }

    const tokens = await this.sessions.create(user.id, client);
    return { user: await this.users.getPublicById(user.id), tokens };
  }

  /** Deletes expired demo accounts and their files. Returns how many were removed. */
  async cleanupExpired(now = new Date()): Promise<number> {
    const expired = await this.prisma.user.findMany({
      where: { demoExpiresAt: { lt: now } },
      select: { id: true },
      take: 500,
    });
    if (expired.length === 0) return 0;
    await this.removeUsers(expired.map((user) => user.id));
    this.logger.log(`Deleted ${expired.length} expired demo account(s)`);
    return expired.length;
  }

  private async removeUsers(ids: string[]): Promise<void> {
    const files = await this.prisma.resume.findMany({
      where: { userId: { in: ids } },
      select: { storageDriver: true, storageKey: true },
    });
    await this.prisma.user.deleteMany({ where: { id: { in: ids } } });
    await this.storage.deleteQuietly(
      files.map((f) => ({ driver: f.storageDriver as StorageDriverName, key: f.storageKey })),
    );
  }
}
