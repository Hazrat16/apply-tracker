import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from '../queue/queue.constants.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly health: HealthIndicatorService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async pingCheck(key: string) {
    const indicator = this.health.check(key);
    try {
      // A real round-trip to Redis, not just "a connection object exists".
      await this.queue.getJobCounts('waiting');
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Redis unreachable',
      });
    }
  }
}
