import type { Analytics } from '@apply-tracker/shared';
import type TestAgent from 'supertest/lib/agent.js';
import { createTestApp, signedInAgent, type TestContext } from './helpers.js';

describe('Analytics (e2e)', () => {
  let ctx: TestContext;
  let jane: TestAgent;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.resetDb();
    jane = await signedInAgent(ctx);
  });

  const analytics = async (agent: TestAgent, range = '90d'): Promise<Analytics> =>
    (await agent.get(`/api/v1/analytics?range=${range}`).expect(200)).body;

  const create = async (body: object) =>
    (
      await jane
        .post('/api/v1/applications')
        .send({ companyName: 'Acme', roleTitle: 'Engineer', ...body })
        .expect(201)
    ).body as { id: string };

  it('summarises applications created and moved through the API', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await create({ status: 'WISHLIST' });
    const a = await create({ status: 'APPLIED', source: 'LINKEDIN', appliedAt: today });
    const b = await create({ status: 'APPLIED', source: 'REFERRAL', appliedAt: today });
    await create({ status: 'APPLIED', source: 'LINKEDIN', appliedAt: today });
    await jane.post(`/api/v1/applications/${a.id}/move`).send({ status: 'INTERVIEW' }).expect(200);
    await jane.post(`/api/v1/applications/${b.id}/move`).send({ status: 'REJECTED' }).expect(200);

    const result = await analytics(jane);
    expect(result.totals).toEqual({ applied: 3, responded: 2, interviewed: 1, offers: 0 });
    expect(result.rates.response).toBeCloseTo(2 / 3);
    expect(result.medianDaysToResponse).toBe(0);
    expect(result.sources[0]).toEqual({
      source: 'LINKEDIN',
      applied: 2,
      responded: 1,
      interviewed: 1,
      offers: 0,
    });
    expect(result.pipeline.find((p) => p.status === 'WISHLIST')?.count).toBe(1);
    expect(result.goal).toMatchObject({ target: 5, thisWeek: 3, streak: 0 });
    expect(result.weekly.at(-1)?.applied).toBe(3);
  });

  it('uses the weekly goal from preferences', async () => {
    await create({ status: 'APPLIED', appliedAt: new Date().toISOString().slice(0, 10) });
    await jane.patch('/api/v1/users/me/preferences').send({ weeklyGoal: 1 }).expect(200);
    expect((await analytics(jane)).goal).toMatchObject({ target: 1, thisWeek: 1, streak: 1 });
    await jane.patch('/api/v1/users/me/preferences').send({ weeklyGoal: 101 }).expect(400);
  });

  it('only counts the signed-in user’s applications', async () => {
    await create({ status: 'APPLIED' });
    const mallory = await signedInAgent(ctx, 'mallory@example.com');
    expect((await analytics(mallory)).totals.applied).toBe(0);
  });

  it('validates the range', async () => {
    await jane.get('/api/v1/analytics?range=7y').expect(400);
    expect((await analytics(jane, 'all')).from).toBeNull();
  });
});
