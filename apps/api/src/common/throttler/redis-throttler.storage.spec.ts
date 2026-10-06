import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

const config = (values: Partial<Env>) =>
  ({ get: (key: keyof Env) => values[key] }) as unknown as ConfigService<Env, true>;

describe('RedisThrottlerStorage', () => {
  it('lets requests through when Redis is unreachable', async () => {
    const storage = new RedisThrottlerStorage(
      config({ REDIS_URL: 'redis://127.0.0.1:1', QUEUE_PREFIX: 'test' }),
    );
    await expect(storage.increment('ip', 60_000, 1, 60_000, 'default')).resolves.toMatchObject({
      isBlocked: false,
    });
    await storage.onModuleDestroy();
  });
});
