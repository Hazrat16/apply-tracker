import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, NotificationList, NotificationType } from '@apply-tracker/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  applicationId?: string | null;
  /** Same key → created at most once per user (safe to retry or re-scan). */
  dedupeKey: string;
}

const LIST_LIMIT = 50;

const toNotification = (row: Prisma.NotificationGetPayload<object>): Notification => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link,
  applicationId: row.applicationId,
  readAt: row.readAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the notification unless one with the same dedupe key exists. Returns whether it was created. */
  async create(notification: NewNotification): Promise<boolean> {
    const { count } = await this.prisma.notification.createMany({
      data: [notification],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async list(userId: string, unreadOnly = false): Promise<NotificationList> {
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId, ...(unreadOnly && { readAt: null }) },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: items.map(toNotification), unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Notification not found');
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
