import type { ApplicationSummary, Resume, User } from '@apply-tracker/shared';
import { DemoService } from '../src/demo/demo.service.js';
import { createTestApp, type TestContext } from './helpers.js';

describe('Try the demo (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.app.close());

  beforeEach(() => ctx.resetDb());

  it('signs a visitor in to their own account full of sample data', async () => {
    expect((await ctx.agent().get('/api/v1/auth/providers').expect(200)).body).toEqual({
      google: false,
      demo: true,
    });

    const visitor = ctx.agent();
    const res = await visitor.post('/api/v1/auth/demo').expect(201);
    const user = res.body as User;
    expect(user).toMatchObject({ isDemo: true, emailVerified: true, hasPassword: false });
    expect(user.email).toMatch(/@demo\.invalid$/);
    const hoursLeft = (new Date(user.demoExpiresAt!).getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeCloseTo(24, 0);

    const board = (await visitor.get('/api/v1/applications/board').expect(200))
      .body as ApplicationSummary[];
    expect(board.length).toBeGreaterThan(10);
    const [resume] = (await visitor.get('/api/v1/resumes').expect(200)).body as Resume[];
    expect(resume).toMatchObject({ label: 'Backend resume', hasText: true, pageCount: 2 });
    await visitor.get(`/api/v1/resumes/${resume!.id}/file`).expect(200);

    // A second visitor gets a separate account.
    const other = ctx.agent();
    const second = (await other.post('/api/v1/auth/demo').expect(201)).body as User;
    expect(second.id).not.toBe(user.id);
  });

  it('cannot become a permanent login', async () => {
    const visitor = ctx.agent();
    await visitor.post('/api/v1/auth/demo').expect(201);
    const res = await visitor
      .post('/api/v1/users/me/password')
      .send({ newPassword: 'correct-horse-1' })
      .expect(400);
    expect(res.body.message).toMatch(/Demo accounts/);
  });

  it('deletes expired demo accounts and their files', async () => {
    const visitor = ctx.agent();
    const user = (await visitor.post('/api/v1/auth/demo').expect(201)).body as User;
    expect(await ctx.prisma.storedFile.count()).toBe(1);

    const demo = ctx.app.get(DemoService);
    expect(await demo.cleanupExpired()).toBe(0);
    expect(await demo.cleanupExpired(new Date(Date.now() + 25 * 3_600_000))).toBe(1);

    expect(await ctx.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await ctx.prisma.storedFile.count()).toBe(0);
    await visitor.get('/api/v1/users/me').expect(401);
  });
});
