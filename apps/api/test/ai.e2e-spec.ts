import { getQueueToken } from '@nestjs/bullmq';
import type { CoverLetter, ResumeDetail, ResumeMatch } from '@apply-tracker/shared';
import type { Job, Queue } from 'bullmq';
import type TestAgent from 'supertest/lib/agent.js';
import { AiProcessor } from '../src/ai/ai.processor.js';
import {
  AI_WRITER,
  type AiWriter,
  type JobPosting,
  type MatchResult,
  PermanentAiError,
} from '../src/ai/writers/ai-writer.js';
import { BuiltinWriter } from '../src/ai/writers/builtin.writer.js';
import { AI_QUEUE, type AiJobData } from '../src/queue/queue.constants.js';
import { makePdf } from './fixtures/make-pdf.js';
import { createTestApp, signedInAgent, type TestContext } from './helpers.js';

const JOB_DESCRIPTION =
  'We are hiring a backend engineer to build APIs with TypeScript, NestJS and PostgreSQL. ' +
  'You will own services end to end, mentor others and work closely with product.';

/** Stands in for a language model so tests never call a real one. */
class FakeWriter implements AiWriter {
  readonly provider = 'openai-compatible';
  readonly model = 'fake-model';
  calls: { resume: string; job: JobPosting }[] = [];
  failure: Error | null = null;
  match: MatchResult = {
    score: 112,
    summary: ' Strong backend fit. ',
    matchedSkills: ['TypeScript', 'TypeScript', ' NestJS '],
    missingSkills: ['Mentoring'],
    suggestions: ['Mention team leadership', '', 'Move NestJS up'],
  };

  matchResume(resume: string, job: JobPosting): Promise<MatchResult> {
    this.calls.push({ resume, job });
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.match);
  }

  writeCoverLetter(resume: string, job: JobPosting): Promise<string> {
    this.calls.push({ resume, job });
    return this.failure ? Promise.reject(this.failure) : Promise.resolve('Dear Hiring Manager, …');
  }
}

describe('AI features (e2e)', () => {
  let ctx: TestContext;
  let jane: TestAgent;
  let claude: FakeWriter;
  let queue: Queue<AiJobData>;
  let processor: AiProcessor;

  beforeAll(async () => {
    claude = new FakeWriter();
    ctx = await createTestApp([[AI_WRITER, claude]]);
    queue = ctx.app.get(getQueueToken(AI_QUEUE));
    // Workers don't run in tests; jobs are handed to the processor directly.
    processor = new AiProcessor(ctx.prisma, claude);
  });

  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    await ctx.resetDb();
    await queue.obliterate({ force: true });
    claude.failure = null;
    claude.calls.length = 0;
    jane = await signedInAgent(ctx);
  });

  const createApplication = async (
    agent: TestAgent,
    jobDescription: string | null = JOB_DESCRIPTION,
  ) =>
    (
      await agent
        .post('/api/v1/applications')
        .send({ companyName: 'Acme', roleTitle: 'Backend Engineer', jobDescription })
        .expect(201)
    ).body as { id: string };

  const uploadResume = async (agent: TestAgent, pages = ['Jane Doe', 'TypeScript, NestJS']) =>
    (await agent.post('/api/v1/resumes').attach('file', makePdf(pages), 'cv.pdf').expect(201))
      .body as ResumeDetail;

  /** Runs every queued job, like the worker would (attemptsMade: 0 = first attempt). */
  const runJobs = async (attemptsMade = 0) => {
    for (const job of await queue.getJobs(['waiting'])) {
      await processor.process({
        name: job.name,
        data: job.data,
        attemptsMade,
        opts: job.opts,
      } as Job<AiJobData>);
    }
  };

  it('reports which engine is in use', async () => {
    expect((await jane.get('/api/v1/ai/status').expect(200)).body).toEqual({
      provider: 'openai-compatible',
      model: 'fake-model',
    });
  });

  it('queues a resume match and stores the cleaned-up result', async () => {
    const app = await createApplication(jane);
    const resume = await uploadResume(jane);

    const queued = await jane
      .post(`/api/v1/applications/${app.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(202);
    expect(queued.body).toMatchObject({ status: 'PENDING', score: null, resumeLabel: 'cv' });
    expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 1 });

    // Asking again while it is queued doesn't queue a second paid call.
    await jane
      .post(`/api/v1/applications/${app.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(202);
    expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 1 });

    await runJobs();
    expect(claude.calls[0]!.job).toEqual({
      roleTitle: 'Backend Engineer',
      companyName: 'Acme',
      description: JOB_DESCRIPTION,
    });
    expect(claude.calls[0]!.resume).toContain('TypeScript, NestJS');

    const [match] = (await jane.get(`/api/v1/applications/${app.id}/matches`).expect(200))
      .body as ResumeMatch[];
    expect(match).toMatchObject({
      status: 'DONE',
      score: 100,
      summary: 'Strong backend fit.',
      matchedSkills: ['TypeScript', 'NestJS'],
      missingSkills: ['Mentoring'],
      suggestions: ['Mention team leadership', 'Move NestJS up'],
      error: null,
    });
    expect(match!.completedAt).not.toBeNull();

    // A finished match can be re-run.
    const rerun = await jane
      .post(`/api/v1/applications/${app.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(202);
    expect(rerun.body).toMatchObject({ id: match!.id, status: 'PENDING', score: null });
  });

  it('drafts, edits and deletes cover letters', async () => {
    const app = await createApplication(jane);
    const resume = await uploadResume(jane);

    const queued = await jane
      .post(`/api/v1/applications/${app.id}/cover-letters`)
      .send({ resumeId: resume.id, tone: 'FRIENDLY', instructions: 'Relocating to Berlin' })
      .expect(202);
    const letter = queued.body as CoverLetter;
    expect(letter).toMatchObject({ status: 'PENDING', tone: 'FRIENDLY', content: null });

    // Unfinished drafts can't be edited.
    await jane.patch(`/api/v1/cover-letters/${letter.id}`).send({ content: 'Hi' }).expect(404);

    await runJobs();
    const [done] = (await jane.get(`/api/v1/applications/${app.id}/cover-letters`).expect(200))
      .body as CoverLetter[];
    expect(done).toMatchObject({ status: 'DONE', content: 'Dear Hiring Manager, …' });

    const edited = await jane
      .patch(`/api/v1/cover-letters/${letter.id}`)
      .send({ content: '  My edited letter  ' })
      .expect(200);
    expect(edited.body.content).toBe('My edited letter');

    // Deleting the resume keeps the letter.
    await jane.delete(`/api/v1/resumes/${resume.id}`).expect(204);
    const [kept] = (await jane.get(`/api/v1/applications/${app.id}/cover-letters`).expect(200))
      .body as CoverLetter[];
    expect(kept).toMatchObject({ resumeId: null, resumeLabel: null, content: 'My edited letter' });

    await jane.delete(`/api/v1/cover-letters/${letter.id}`).expect(204);
    expect((await jane.get(`/api/v1/applications/${app.id}/cover-letters`)).body).toEqual([]);
  });

  it('retries temporary failures and marks the task failed on the last attempt', async () => {
    const app = await createApplication(jane);
    const resume = await uploadResume(jane);
    await jane
      .post(`/api/v1/applications/${app.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(202);

    claude.failure = new Error('overloaded');
    await expect(runJobs(0)).rejects.toThrow('overloaded');
    let [match] = (await jane.get(`/api/v1/applications/${app.id}/matches`)).body as ResumeMatch[];
    expect(match!.status).toBe('RUNNING');

    await runJobs(2); // third and last attempt
    [match] = (await jane.get(`/api/v1/applications/${app.id}/matches`)).body as ResumeMatch[];
    expect(match).toMatchObject({ status: 'FAILED', error: expect.stringMatching(/try again/i) });
  });

  it('fails permanent errors without retrying', async () => {
    const app = await createApplication(jane);
    const resume = await uploadResume(jane);
    await jane
      .post(`/api/v1/applications/${app.id}/cover-letters`)
      .send({ resumeId: resume.id })
      .expect(202);

    claude.failure = new PermanentAiError('refused');
    await runJobs(0);
    const [letter] = (await jane.get(`/api/v1/applications/${app.id}/cover-letters`))
      .body as CoverLetter[];
    expect(letter!.status).toBe('FAILED');
  });

  it('explains what is missing before queueing anything', async () => {
    const resume = await uploadResume(jane);
    const noDescription = await createApplication(jane, null);
    const res = await jane
      .post(`/api/v1/applications/${noDescription.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(400);
    expect(res.body.message).toMatch(/job description/);

    const app = await createApplication(jane);
    const scanned = await uploadResume(jane, ['']);
    const noText = await jane
      .post(`/api/v1/applications/${app.id}/cover-letters`)
      .send({ resumeId: scanned.id })
      .expect(400);
    expect(noText.body.message).toMatch(/no selectable text/);

    expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 0 });
  });

  it("never uses another user's application or resume", async () => {
    const app = await createApplication(jane);
    const resume = await uploadResume(jane);
    const mallory = await signedInAgent(ctx, 'mallory@example.com');
    const malloryApp = await createApplication(mallory);
    await jane.post(`/api/v1/applications/${app.id}/cover-letters`).send({ resumeId: resume.id });
    const [letter] = (await jane.get(`/api/v1/applications/${app.id}/cover-letters`))
      .body as CoverLetter[];

    await mallory.get(`/api/v1/applications/${app.id}/matches`).expect(404);
    await mallory
      .post(`/api/v1/applications/${app.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(404);
    await mallory
      .post(`/api/v1/applications/${malloryApp.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(404);
    await mallory.delete(`/api/v1/cover-letters/${letter!.id}`).expect(404);
  });
});

describe('AI features with the free built-in engine (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // No overrides: with no API key configured, the app must default to the built-in engine.
    ctx = await createTestApp();
  });

  afterAll(() => ctx.app.close());

  it('matches and drafts a letter without any AI service', async () => {
    await ctx.resetDb();
    const queue = ctx.app.get<Queue<AiJobData>>(getQueueToken(AI_QUEUE));
    await queue.obliterate({ force: true });
    const jane = await signedInAgent(ctx);

    expect((await jane.get('/api/v1/ai/status').expect(200)).body).toEqual({
      provider: 'builtin',
      model: null,
    });

    const app = (
      await jane
        .post('/api/v1/applications')
        .send({
          companyName: 'Acme',
          roleTitle: 'Backend Engineer',
          jobDescription: JOB_DESCRIPTION,
        })
        .expect(201)
    ).body as { id: string };
    const resume = (
      await jane
        .post('/api/v1/resumes')
        .attach('file', makePdf(['Jane Doe', 'Backend engineer: TypeScript and NestJS']), 'cv.pdf')
        .expect(201)
    ).body as ResumeDetail;

    await jane
      .post(`/api/v1/applications/${app.id}/matches`)
      .send({ resumeId: resume.id })
      .expect(202);
    await jane
      .post(`/api/v1/applications/${app.id}/cover-letters`)
      .send({ resumeId: resume.id })
      .expect(202);

    const processor = new AiProcessor(ctx.prisma, new BuiltinWriter());
    for (const job of await queue.getJobs(['waiting'])) {
      await processor.process({
        name: job.name,
        data: job.data,
        attemptsMade: 0,
        opts: job.opts,
      } as Job<AiJobData>);
    }

    const [match] = (await jane.get(`/api/v1/applications/${app.id}/matches`))
      .body as ResumeMatch[];
    expect(match).toMatchObject({
      status: 'DONE',
      matchedSkills: ['NestJS', 'TypeScript'],
      missingSkills: ['Mentoring', 'PostgreSQL'],
    });
    expect(match!.score).toBe(50);

    const [letter] = (await jane.get(`/api/v1/applications/${app.id}/cover-letters`))
      .body as CoverLetter[];
    expect(letter!.status).toBe('DONE');
    expect(letter!.content).toContain('Backend Engineer position at Acme');
    expect(letter!.content).toMatch(/Jane Doe$/);
  });
});
