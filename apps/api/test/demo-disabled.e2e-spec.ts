import type { TestContext } from './helpers.js';

describe('Demo disabled (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // The env is validated when the app module loads, so stub it before importing.
    vi.stubEnv('DEMO_ENABLED', 'false');
    const { createTestApp } = await import('./helpers.js');
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    vi.unstubAllEnvs();
  });

  it('hides the demo', async () => {
    expect((await ctx.agent().get('/api/v1/auth/providers')).body).toEqual({
      google: false,
      demo: false,
    });
    await ctx.agent().post('/api/v1/auth/demo').expect(404);
  });
});
