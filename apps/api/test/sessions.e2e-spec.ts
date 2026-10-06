import type { SessionInfo } from '@apply-tracker/shared';
import { createTestApp, signedInAgent, type TestContext, validUser } from './helpers.js';

describe('Active sessions (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.app.close());

  beforeEach(() => ctx.resetDb());

  const signIn = async (userAgent: string) => {
    const agent = ctx.agent();
    await agent
      .post('/api/v1/auth/login')
      .set('User-Agent', userAgent)
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);
    return agent;
  };

  const sessions = async (agent: ReturnType<TestContext['agent']>) =>
    (await agent.get('/api/v1/users/me/sessions').expect(200)).body as SessionInfo[];

  it('lists devices and signs one out immediately', async () => {
    await signedInAgent(ctx);
    const laptop = await signIn('Laptop browser');
    const phone = await signIn('Phone browser');

    const list = await sessions(laptop);
    expect(list).toHaveLength(3);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    const phoneSession = list.find((s) => s.userAgent === 'Phone browser')!;
    expect(phoneSession.current).toBe(false);

    await laptop.delete(`/api/v1/users/me/sessions/${phoneSession.id}`).expect(204);
    // The phone's access token is still unexpired, but the session is over.
    await phone.get('/api/v1/users/me').expect(401);
    await phone.post('/api/v1/auth/refresh').expect(401);
    await laptop.get('/api/v1/users/me').expect(200);
    expect(await sessions(laptop)).toHaveLength(2);
  });

  it('signs out every other device', async () => {
    const first = await signedInAgent(ctx);
    const second = await signIn('Second');
    const third = await signIn('Third');

    await second.delete('/api/v1/users/me/sessions').expect(204);
    await first.get('/api/v1/users/me').expect(401);
    await third.get('/api/v1/users/me').expect(401);
    const [only] = await sessions(second);
    expect(only).toMatchObject({ current: true, userAgent: 'Second' });
  });

  it('refuses the current session and other users’ sessions', async () => {
    const jane = await signedInAgent(ctx);
    const [current] = await sessions(jane);
    await jane.delete(`/api/v1/users/me/sessions/${current!.id}`).expect(400);

    const mallory = await signedInAgent(ctx, 'mallory@example.com');
    await mallory.delete(`/api/v1/users/me/sessions/${current!.id}`).expect(404);
    await jane.get('/api/v1/users/me').expect(200);
  });

  it('ends the session on logout', async () => {
    const jane = await signedInAgent(ctx);
    await jane.post('/api/v1/auth/logout').expect(204);
    // Even a copied access token stops working.
    await jane.get('/api/v1/users/me').expect(401);
  });
});
