import type { ApplicationDetail, ApplicationSummary } from '@apply-tracker/shared';
import type TestAgent from 'supertest/lib/agent.js';
import { createTestApp, signedInAgent, type TestContext } from './helpers.js';

describe('Applications (e2e)', () => {
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

  const create = async (agent: TestAgent, body: object): Promise<ApplicationDetail> =>
    (await agent.post('/api/v1/applications').send(body).expect(201)).body;

  const board = async (agent: TestAgent): Promise<ApplicationSummary[]> =>
    (await agent.get('/api/v1/applications/board').expect(200)).body;

  const column = async (agent: TestAgent, status: string) =>
    (await board(agent)).filter((a) => a.status === status).map((a) => a.roleTitle);

  describe('create', () => {
    it('creates the company once per user, case-insensitively', async () => {
      const first = await create(jane, { companyName: 'Acme', roleTitle: 'Backend Engineer' });
      const second = await create(jane, { companyName: ' acme ', roleTitle: 'Frontend Engineer' });

      expect(first).toMatchObject({
        status: 'WISHLIST',
        priority: 'MEDIUM',
        currency: 'USD',
        company: { name: 'Acme' },
        statusHistory: [{ fromStatus: null, toStatus: 'WISHLIST' }],
      });
      expect(second.company.id).toBe(first.company.id);

      const companies = await jane.get('/api/v1/companies?search=ac').expect(200);
      expect(companies.body).toEqual([{ id: first.company.id, name: 'Acme' }]);
    });

    it('validates input', async () => {
      const res = await jane
        .post('/api/v1/applications')
        .send({ companyName: '', roleTitle: 'x', status: 'HIRED' })
        .expect(400);
      expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
        'companyName',
        'status',
      ]);

      const range = await jane
        .post('/api/v1/applications')
        .send({ companyName: 'Acme', roleTitle: 'x', salaryMin: 5, salaryMax: 1 })
        .expect(400);
      expect(range.body.issues).toEqual([
        { path: 'salaryMax', message: 'Must be at least the minimum salary' },
      ]);
    });

    it('rejects non-UUID ids with 400', async () => {
      await jane.get('/api/v1/applications/not-a-uuid').expect(400);
    });
  });

  describe('isolation between users', () => {
    it("never exposes or modifies another user's applications", async () => {
      const app = await create(jane, { companyName: 'Acme', roleTitle: 'Engineer' });
      const mallory = await signedInAgent(ctx, 'mallory@example.com');
      const path = `/api/v1/applications/${app.id}`;

      await mallory.get(path).expect(404);
      await mallory.patch(path).send({ roleTitle: 'Hacked' }).expect(404);
      await mallory.post(`${path}/move`).send({ status: 'OFFER' }).expect(404);
      await mallory.post(`${path}/notes`).send({ body: 'hi' }).expect(404);
      await mallory.delete(path).expect(404);

      expect((await mallory.get('/api/v1/applications').expect(200)).body.total).toBe(0);
      expect(await board(mallory)).toEqual([]);
      expect((await mallory.get('/api/v1/companies').expect(200)).body).toEqual([]);
      expect((await jane.get(path).expect(200)).body.roleTitle).toBe('Engineer');
    });

    it("rejects another user's tags", async () => {
      const mallory = await signedInAgent(ctx, 'mallory@example.com');
      const tag = (await mallory.post('/api/v1/tags').send({ name: 'secret' }).expect(201)).body;
      await jane
        .post('/api/v1/applications')
        .send({ companyName: 'Acme', roleTitle: 'Engineer', tagIds: [tag.id] })
        .expect(400);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await create(jane, { companyName: 'Globex', roleTitle: 'Designer', status: 'APPLIED' });
      await create(jane, {
        companyName: 'Acme',
        roleTitle: 'Engineer',
        status: 'INTERVIEW',
        location: 'Berlin',
      });
      await create(jane, { companyName: 'Initech', roleTitle: 'Engineer II', status: 'APPLIED' });
    });

    it('searches role, company and location', async () => {
      const byRole = await jane.get('/api/v1/applications?search=engineer').expect(200);
      expect(byRole.body.total).toBe(2);
      const byLocation = await jane.get('/api/v1/applications?search=berlin').expect(200);
      expect(byLocation.body.items.map((a: ApplicationSummary) => a.company.name)).toEqual([
        'Acme',
      ]);
    });

    it('filters by status and sorts by company', async () => {
      const res = await jane
        .get('/api/v1/applications?status=APPLIED,INTERVIEW&sort=company&order=asc')
        .expect(200);
      expect(res.body.items.map((a: ApplicationSummary) => a.company.name)).toEqual([
        'Acme',
        'Globex',
        'Initech',
      ]);
    });

    it('paginates', async () => {
      const res = await jane
        .get('/api/v1/applications?pageSize=2&page=2&sort=role&order=asc')
        .expect(200);
      expect(res.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(res.body.items.map((a: ApplicationSummary) => a.roleTitle)).toEqual(['Engineer II']);
    });
  });

  describe('update', () => {
    it('records status changes and archives', async () => {
      const app = await create(jane, { companyName: 'Acme', roleTitle: 'Engineer' });
      const path = `/api/v1/applications/${app.id}`;

      const updated = (
        await jane
          .patch(path)
          .send({ status: 'APPLIED', appliedAt: '2026-09-30', salaryMin: 50000 })
          .expect(200)
      ).body as ApplicationDetail;
      expect(updated).toMatchObject({
        status: 'APPLIED',
        appliedAt: '2026-09-30',
        salaryMin: 50000,
      });
      expect(updated.statusHistory.map((s) => s.toStatus)).toEqual(['WISHLIST', 'APPLIED']);

      await jane.patch(path).send({ archived: true }).expect(200);
      expect(await board(jane)).toEqual([]);
      expect((await jane.get('/api/v1/applications').expect(200)).body.total).toBe(0);
      expect((await jane.get('/api/v1/applications?archived=true').expect(200)).body.total).toBe(1);
    });

    it('assigns tags and filters by them', async () => {
      const tag = (
        await jane.post('/api/v1/tags').send({ name: 'remote-first', color: 'teal' }).expect(201)
      ).body;
      const app = await create(jane, { companyName: 'Acme', roleTitle: 'Engineer' });
      await create(jane, { companyName: 'Globex', roleTitle: 'Engineer' });

      const updated = await jane
        .patch(`/api/v1/applications/${app.id}`)
        .send({ tagIds: [tag.id] })
        .expect(200);
      expect(updated.body.tags).toEqual([{ id: tag.id, name: 'remote-first', color: 'teal' }]);

      const filtered = await jane.get(`/api/v1/applications?tagId=${tag.id}`).expect(200);
      expect(filtered.body.items.map((a: ApplicationSummary) => a.id)).toEqual([app.id]);

      await jane.post('/api/v1/tags').send({ name: 'remote-first' }).expect(409);
      await jane.delete(`/api/v1/tags/${tag.id}`).expect(204);
      expect((await jane.get(`/api/v1/applications/${app.id}`).expect(200)).body.tags).toEqual([]);
    });
  });

  describe('board moves', () => {
    it('reorders within a column and moves across columns', async () => {
      // New cards go to the top: C, B, A
      const a = await create(jane, { companyName: 'Acme', roleTitle: 'A', status: 'APPLIED' });
      const b = await create(jane, { companyName: 'Acme', roleTitle: 'B', status: 'APPLIED' });
      const c = await create(jane, { companyName: 'Acme', roleTitle: 'C', status: 'APPLIED' });
      expect(await column(jane, 'APPLIED')).toEqual(['C', 'B', 'A']);

      // Drop C between B and A.
      await jane
        .post(`/api/v1/applications/${c.id}/move`)
        .send({ status: 'APPLIED', beforeId: b.id, afterId: a.id })
        .expect(200);
      expect(await column(jane, 'APPLIED')).toEqual(['B', 'C', 'A']);

      // Drop A into the empty INTERVIEW column.
      const moved = await jane
        .post(`/api/v1/applications/${a.id}/move`)
        .send({ status: 'INTERVIEW' })
        .expect(200);
      expect(moved.body.status).toBe('INTERVIEW');
      expect(await column(jane, 'APPLIED')).toEqual(['B', 'C']);
      expect(await column(jane, 'INTERVIEW')).toEqual(['A']);

      const history = (await jane.get(`/api/v1/applications/${a.id}`).expect(200)).body
        .statusHistory;
      expect(history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'APPLIED',
        'INTERVIEW',
      ]);
    });

    it('renumbers the column when there is no room between two cards', async () => {
      const a = await create(jane, { companyName: 'Acme', roleTitle: 'A', status: 'APPLIED' });
      const b = await create(jane, { companyName: 'Acme', roleTitle: 'B', status: 'APPLIED' });
      const c = await create(jane, { companyName: 'Acme', roleTitle: 'C', status: 'APPLIED' });
      await ctx.prisma.application.update({ where: { id: b.id }, data: { position: 1 } });
      await ctx.prisma.application.update({ where: { id: a.id }, data: { position: 1 + 1e-9 } });

      await jane
        .post(`/api/v1/applications/${c.id}/move`)
        .send({ status: 'APPLIED', beforeId: b.id, afterId: a.id })
        .expect(200);
      expect(await column(jane, 'APPLIED')).toEqual(['B', 'C', 'A']);
    });

    it('rejects neighbours that are not in the target column', async () => {
      const a = await create(jane, { companyName: 'Acme', roleTitle: 'A', status: 'APPLIED' });
      const b = await create(jane, { companyName: 'Acme', roleTitle: 'B', status: 'OFFER' });
      await jane
        .post(`/api/v1/applications/${a.id}/move`)
        .send({ status: 'APPLIED', beforeId: b.id })
        .expect(400);
    });
  });

  describe('notes, contacts and interviews', () => {
    it('manages child records and shows the next interview on the card', async () => {
      const app = await create(jane, {
        companyName: 'Acme',
        roleTitle: 'Engineer',
        status: 'INTERVIEW',
      });
      const base = `/api/v1/applications/${app.id}`;

      const note = (await jane.post(`${base}/notes`).send({ body: 'Great team' }).expect(201)).body;
      await jane
        .patch(`${base}/notes/${note.id}`)
        .send({ body: 'Great team, fast process' })
        .expect(200);

      const contact = (
        await jane
          .post(`${base}/contacts`)
          .send({ name: 'Sam Recruiter', email: 'sam@acme.example', role: '' })
          .expect(201)
      ).body;
      expect(contact).toMatchObject({ name: 'Sam Recruiter', role: null });
      await jane.post(`${base}/contacts`).send({ name: 'Bad', email: 'nope' }).expect(400);

      const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
      const later = new Date(Date.now() + 9 * 86_400_000).toISOString();
      await jane
        .post(`${base}/interviews`)
        .send({ type: 'TECHNICAL', scheduledAt: later })
        .expect(201);
      const first = (
        await jane
          .post(`${base}/interviews`)
          .send({ type: 'PHONE_SCREEN', scheduledAt: soon })
          .expect(201)
      ).body;

      const card = (await board(jane))[0]!;
      expect(card.nextInterviewAt).toBe(soon);

      // Recording an outcome means it is no longer "upcoming".
      await jane
        .put(`${base}/interviews/${first.id}`)
        .send({ type: 'PHONE_SCREEN', scheduledAt: soon, outcome: 'PASSED' })
        .expect(200);
      expect((await board(jane))[0]!.nextInterviewAt).toBe(later);

      const detail = (await jane.get(base).expect(200)).body as ApplicationDetail;
      expect(detail.notes.map((n) => n.body)).toEqual(['Great team, fast process']);
      expect(detail.contacts).toHaveLength(1);
      expect(detail.interviews.map((i) => i.type)).toEqual(['PHONE_SCREEN', 'TECHNICAL']);

      await jane.delete(`${base}/notes/${note.id}`).expect(204);
      await jane.delete(`${base}/notes/${note.id}`).expect(404);
      await jane.delete(`${base}/contacts/${contact.id}`).expect(204);
    });
  });

  describe('CSV', () => {
    it('exports and re-imports applications', async () => {
      const tag = (await jane.post('/api/v1/tags').send({ name: 'backend' }).expect(201)).body;
      await create(jane, {
        companyName: 'Acme',
        roleTitle: 'Engineer, Platform',
        status: 'APPLIED',
        tagIds: [tag.id],
        salaryMin: 90000,
      });

      const exported = await jane.get('/api/v1/applications/export').expect(200);
      expect(exported.headers['content-type']).toMatch(/text\/csv/);
      expect(exported.headers['content-disposition']).toContain('applications.csv');

      const mallory = await signedInAgent(ctx, 'mallory@example.com');
      const csv = `${exported.text}Globex,,APPLIED\n`;
      const res = await mallory
        .post('/api/v1/applications/import')
        .attach('file', Buffer.from(csv), 'applications.csv')
        .expect(201);
      expect(res.body).toEqual({
        created: 1,
        errors: [{ row: 3, message: 'roleTitle: Role is required' }],
      });

      const imported = (await board(mallory))[0]!;
      expect(imported).toMatchObject({
        roleTitle: 'Engineer, Platform',
        status: 'APPLIED',
        salaryMin: 90000,
        company: { name: 'Acme' },
        tags: [{ name: 'backend' }],
      });
    });

    it('rejects files that are not CSV', async () => {
      await jane
        .post('/api/v1/applications/import')
        .attach('file', Buffer.from('hello'), 'notes.txt')
        .expect(400);
    });
  });

  it('deletes an application', async () => {
    const app = await create(jane, { companyName: 'Acme', roleTitle: 'Engineer' });
    await jane.delete(`/api/v1/applications/${app.id}`).expect(204);
    await jane.get(`/api/v1/applications/${app.id}`).expect(404);
  });
});
