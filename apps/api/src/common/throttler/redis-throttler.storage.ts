import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env.js';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;
type ThrottleCommand = (...args: (string | number)[]) => Promise<[number, number, number, number]>;

/**
 * One atomic step of a fixed-window limiter with blocking:
 * KEYS[1] hit counter, KEYS[2] block flag; ARGV ttl ms, limit, block duration ms.
 * Returns { hits, ms until the window resets, blocked (0/1), ms until the block ends }.
 */
const INCREMENT = `
local blockMs = redis.call('PTTL', KEYS[2])
if blockMs > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockMs }
end
local hits = redis.call('INCR', KEYS[1])
local ttlMs = redis.call('PTTL', KEYS[1])
if ttlMs < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttlMs = tonumber(ARGV[1])
end
if hits > tonumber(ARGV[2]) then
  local block = tonumber(ARGV[3])
  if block > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', block)
    -- A fresh window starts once the block ends.
    redis.call('DEL', KEYS[1])
    return { hits, ttlMs, 1, block }
  end
  return { hits, ttlMs, 1, 0 }
end
return { hits, ttlMs, 0, 0 }
`;

/**
 * Rate-limit counters in Redis, so limits hold across several API instances (the default
 * in-memory store counts per process). If Redis is unreachable, requests are let through
 * rather than failing the whole API.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(config: ConfigService<Env, true>) {
    this.prefix = config.get('QUEUE_PREFIX', { infer: true });
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      // Fail fast instead of queueing: a slow Redis must not stall every request.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    // Connection errors are reported per request below; avoid unhandled 'error' events.
    this.redis.on('error', () => undefined);
    this.redis.defineCommand('throttle', { numberOfKeys: 2, lua: INCREMENT });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `${this.prefix}:throttle:${throttlerName}:${key}`;
    try {
      const throttle = (this.redis as Redis & { throttle: ThrottleCommand }).throttle;
      const [hits, ttlMs, blocked, blockMs] = await throttle.call(
        this.redis,
        `${base}:hits`,
        `${base}:block`,
        ttl,
        limit,
        blockDuration,
      );
      return {
        totalHits: hits,
        // The guard reports these in seconds (Retry-After, X-RateLimit-Reset).
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    } catch (error) {
      this.logger.warn({ err: error as unknown }, 'Rate limit check skipped: Redis unavailable');
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
