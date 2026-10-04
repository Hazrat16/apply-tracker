import { Injectable } from '@nestjs/common';
import type { Analytics, AnalyticsRange } from '@apply-tracker/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeAnalytics } from './analytics.calc.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the user's applications with their status history and computes the metrics in
   * memory: a personal job search is hundreds of rows, and the metrics read more clearly
   * (and are easier to test) as code than as SQL.
   */
  async get(userId: string, range: AnalyticsRange, now = new Date()): Promise<Analytics> {
    const [user, apps] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timeZone: true, weeklyGoal: true },
      }),
      this.prisma.application.findMany({
        where: { userId },
        select: {
          status: true,
          source: true,
          appliedAt: true,
          createdAt: true,
          archivedAt: true,
          statusHistory: { select: { toStatus: true, changedAt: true } },
        },
      }),
    ]);

    return computeAnalytics(
      apps.map(({ statusHistory, ...app }) => ({ ...app, history: statusHistory })),
      { range, timeZone: user.timeZone, weeklyGoal: user.weeklyGoal, now },
    );
  }
}
