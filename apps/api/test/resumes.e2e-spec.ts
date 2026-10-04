import type { Resume, ResumeDetail } from '@apply-tracker/shared';
import type TestAgent from 'supertest/lib/agent.js';
import { makePdf } from './fixtures/make-pdf.js';
import { createTestApp, signedInAgent, type TestContext, validUser } from './helpers.js';

const resumePdf = makePdf(['Jane Doe — Software Engineer', 'Skills: TypeScript, NestJS']);

describe('Resumes (e2e)', () => {
  let ctx: TestContext;
  let jane: TestAgent;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    await ctx.resetDb();
    jane = await signedInAgent(ctx);
  });

  const upload = (agent: TestAgent, file = resumePdf, name = 'Jane Doe CV.pdf') =>
    agent.post('/api/v1/resumes').attach('file', file, name);

  it('uploads a PDF, extracts its text and keeps the file in Postgres by default', async () => {
    const res = await upload(jane).expect(201);
    const resume = res.body as ResumeDetail;
    expect(resume).toMatchObject({
      label: 'Jane Doe CV',
      fileName: 'Jane Doe CV.pdf',
      sizeBytes: resumePdf.length,
      pageCount: 2,
      hasText: true,
    });
    expect(resume.text).toContain('Skills: TypeScript, NestJS');

    const row = await ctx.prisma.resume.findUniqueOrThrow({ where: { id: resume.id } });
    expect(row.storageDriver).toBe('database');
    const stored = await ctx.prisma.storedFile.findUniqueOrThrow({
      where: { key: row.storageKey },
    });
    expect(Buffer.from(stored.data).equals(resumePdf)).toBe(true);
  });

  it('lists, renames, serves and deletes resumes', async () => {
    const { body: created } = (await upload(jane).field('label', 'Backend').expect(201)) as {
      body: ResumeDetail;
    };
    expect(created.label).toBe('Backend');

    const list = await jane.get('/api/v1/resumes').expect(200);
    expect((list.body as Resume[]).map((r) => r.id)).toEqual([created.id]);
    expect(list.body[0]).not.toHaveProperty('text');

    const renamed = await jane
      .patch(`/api/v1/resumes/${created.id}`)
      .send({ label: '  Backend roles  ' })
      .expect(200);
    expect(renamed.body.label).toBe('Backend roles');

    const file = await jane
      .get(`/api/v1/resumes/${created.id}/file?download=true`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toBe(
      `attachment; filename="Jane Doe CV.pdf"; filename*=UTF-8''Jane%20Doe%20CV.pdf`,
    );
    expect((file.body as Buffer).equals(resumePdf)).toBe(true);

    await jane.delete(`/api/v1/resumes/${created.id}`).expect(204);
    await jane.get(`/api/v1/resumes/${created.id}`).expect(404);
    expect(await ctx.prisma.storedFile.count()).toBe(0);
  });

  it('rejects files that are not readable PDFs', async () => {
    const notPdf = await upload(jane, Buffer.from('hello'), 'cv.pdf').expect(400);
    expect(notPdf.body.message).toMatch(/not a PDF/);
    await upload(jane, Buffer.from('%PDF-1.4\nbroken'), 'cv.pdf').expect(400);
    await jane.post('/api/v1/resumes').expect(400);
    expect(await ctx.prisma.storedFile.count()).toBe(0);
  });

  it('rejects files over 5 MB and labels that are too long', async () => {
    await upload(jane, Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
    await upload(jane).field('label', 'x'.repeat(81)).expect(400);
  });

  it('limits how many resumes a user keeps', async () => {
    const { id: userId } = await ctx.prisma.user.findFirstOrThrow();
    await ctx.prisma.resume.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        userId,
        label: `CV ${i}`,
        fileName: 'cv.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1,
        storageDriver: 'database',
        storageKey: `resumes/test/${i}.pdf`,
        text: '',
        pageCount: 1,
      })),
    });
    await upload(jane).expect(409);
  });

  it('keeps resumes private to their owner', async () => {
    const { body: created } = (await upload(jane).expect(201)) as { body: ResumeDetail };
    const mallory = await signedInAgent(ctx, 'mallory@example.com');

    expect((await mallory.get('/api/v1/resumes').expect(200)).body).toEqual([]);
    await mallory.get(`/api/v1/resumes/${created.id}`).expect(404);
    await mallory.get(`/api/v1/resumes/${created.id}/file`).expect(404);
    await mallory.patch(`/api/v1/resumes/${created.id}`).send({ label: 'Mine' }).expect(404);
    await mallory.delete(`/api/v1/resumes/${created.id}`).expect(404);
    await jane.get(`/api/v1/resumes/${created.id}`).expect(200);
  });

  it('reports files kept in S3 as unavailable while S3 is not configured', async () => {
    const { body: created } = (await upload(jane).expect(201)) as { body: ResumeDetail };
    await ctx.prisma.resume.update({ where: { id: created.id }, data: { storageDriver: 's3' } });

    await jane.get(`/api/v1/resumes/${created.id}/file`).expect(503);
    // Text and metadata live in Postgres, so the resume itself still works.
    await jane.get(`/api/v1/resumes/${created.id}`).expect(200);
    // Deleting still succeeds; the unreachable file is only logged.
    await jane.delete(`/api/v1/resumes/${created.id}`).expect(204);
  });

  it('removes stored files when the account is deleted', async () => {
    await upload(jane).expect(201);
    await jane.delete('/api/v1/users/me').send({ password: validUser.password }).expect(204);
    expect(await ctx.prisma.resume.count()).toBe(0);
    expect(await ctx.prisma.storedFile.count()).toBe(0);
  });
});
