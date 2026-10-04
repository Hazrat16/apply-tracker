import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AI_QUEUE, EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from './queue.constants.js';
import { redisOptionsFromUrl } from './redis-connection.js';

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/** Redis-backed job queues (BullMQ), shared by the API (producers) and workers (consumers). */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: redisOptionsFromUrl(config.get('REDIS_URL', { infer: true })),
        prefix: config.get('QUEUE_PREFIX', { infer: true }),
      }),
    }),
    BullModule.registerQueue(
      { name: NOTIFICATIONS_QUEUE, defaultJobOptions },
      { name: EMAIL_QUEUE, defaultJobOptions },
      // Claude calls are slow and cost money: fewer, longer-spaced retries.
      {
        name: AI_QUEUE,
        defaultJobOptions: {
          ...defaultJobOptions,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
