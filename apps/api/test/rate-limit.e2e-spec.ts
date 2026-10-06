import { Redis } from 'ioredis';
import type { TestContext } from './helpers.js';

describe('Rate limiting (e2e)', () => {
  let ctx: TestContext;
  let other: TestContext;

  beforeAll(async () => {
    // Counters live in Redis and outlive a test run; start from a clean slate.
    const redis = new Redis(process.env.REDIS_URL!);
    const keys = await redis.keys(`${process.env.QUEUE_PREFIX}:throttle:*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();

    // Rate limiting is off for the other e2e suites; enable it before the app module loads.
    vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
    const { createTestApp } = await import('./helpers.js');
    ctx = await createTestApp();
    // A second API instance, as when the API is scaled out.
    other = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await other.app.close();
    vi.unstubAllEnvs();
  });

  it('blocks repeated login attempts with 429, counted across API instances', async () => {
    const attempt = (app: TestContext) =>
      app
        .agent()
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@example.com', password: 'guess-123' });

    // 10 attempts allowed in total, split between the two instances.
    for (let i = 0; i < 5; i++) {
      await attempt(ctx).expect(401);
      await attempt(other).expect(401);
    }
    const res = await attempt(ctx).expect(429);
    expect(res.body.statusCode).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    await attempt(other).expect(429);
  });
});
