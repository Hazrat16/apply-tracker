import { createTestApp, type TestContext } from './helpers.js';

describe('App (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/health reports the database as up', async () => {
    const res = await ctx.agent().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', details: { database: { status: 'up' } } });
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await ctx
      .agent()
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'test-request')
      .expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'NOT_FOUND',
      path: '/api/v1/does-not-exist',
      requestId: 'test-request',
    });
    expect(res.headers['x-request-id']).toBe('test-request');
  });

  it('rejects state-changing requests from untrusted origins (CSRF)', async () => {
    const res = await ctx
      .agent()
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.co', password: 'x' })
      .expect(403);
    expect(res.body.message).toBe('Origin not allowed');
  });

  it('allows requests from the web app origin', async () => {
    await ctx
      .agent()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'nobody@example.com', password: 'whatever1' })
      .expect(401);
  });
});
