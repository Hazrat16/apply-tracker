import type { TestContext } from './helpers.js';

describe('Rate limiting (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // Rate limiting is off for the other e2e suites; enable it before the app module loads.
    vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
    const { createTestApp } = await import('./helpers.js');
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    vi.unstubAllEnvs();
  });

  it('blocks repeated login attempts with 429', async () => {
    const attempt = () =>
      ctx
        .agent()
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@example.com', password: 'guess-123' });

    for (let i = 0; i < 10; i++) await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
