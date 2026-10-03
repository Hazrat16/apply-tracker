import { readFileSync } from 'node:fs';
import type { JobPreview } from '@apply-tracker/shared';
import type TestAgent from 'supertest/lib/agent.js';
import { AiJobExtractor } from '../src/job-import/ai-job-extractor.js';
import type { DraftPart } from '../src/job-import/extract/types.js';
import { type FetchedPage, PageFetchError, SafePageFetcher } from '../src/job-import/safe-fetch.js';
import { createTestApp, signedInAgent, type TestContext } from './helpers.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/job-pages/${name}`, import.meta.url), 'utf8');

/** Serves fixture pages instead of fetching the internet. */
class FakeFetcher {
  readonly requested: string[] = [];
  pages = new Map<string, string | PageFetchError>();

  fetchPage(url: string): Promise<FetchedPage> {
    this.requested.push(url);
    const page = this.pages.get(url);
    if (page instanceof PageFetchError) return Promise.reject(page);
    if (page === undefined)
      return Promise.reject(new PageFetchError('http_error', 'Not found', 404));
    return Promise.resolve({ url, html: page });
  }
}

class FakeAi {
  enabled = true;
  calls: string[] = [];
  result: DraftPart | null = null;

  extract(text: string): Promise<DraftPart | null> {
    this.calls.push(text);
    return Promise.resolve(this.result);
  }
}

describe('Job import (e2e)', () => {
  let ctx: TestContext;
  let jane: TestAgent;
  const fetcher = new FakeFetcher();
  const ai = new FakeAi();

  beforeAll(async () => {
    ctx = await createTestApp([
      [SafePageFetcher, fetcher],
      [AiJobExtractor, ai],
    ]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.resetDb();
    jane = await signedInAgent(ctx);
    fetcher.requested.length = 0;
    fetcher.pages.clear();
    ai.calls.length = 0;
    ai.result = null;
    ai.enabled = true;
  });

  const previewLink = async (url: string, status = 200): Promise<JobPreview> =>
    (await jane.post('/api/v1/job-imports/preview-link').send({ url }).expect(status)).body;

  it('requires authentication', async () => {
    await ctx
      .agent()
      .post('/api/v1/job-imports/preview-link')
      .send({ url: 'https://example.com' })
      .expect(401);
  });

  it('reports capabilities', async () => {
    expect((await jane.get('/api/v1/job-imports/capabilities').expect(200)).body).toEqual({
      ai: true,
    });
  });

  it('builds a draft from structured data, without calling the AI', async () => {
    fetcher.pages.set(
      'https://boards.greenhouse.io/acme/jobs/1?gh_src=abc',
      fixture('greenhouse-json-ld.html'),
    );

    const preview = await previewLink('https://boards.greenhouse.io/acme/jobs/1?gh_src=abc');
    expect(preview).toMatchObject({
      fetched: true,
      message: null,
      duplicate: null,
      methods: ['STRUCTURED_DATA'],
      draft: {
        companyName: 'Acme Robotics',
        roleTitle: 'Senior Backend Engineer & Platform',
        location: 'Berlin, DE',
        salaryMin: 75000,
        currency: 'EUR',
        source: 'COMPANY_WEBSITE',
        jobUrl: 'https://boards.greenhouse.io/acme/jobs/1',
      },
    });
    expect(ai.calls).toHaveLength(0);
  });

  it('fetches the public LinkedIn page for any LinkedIn job link and detects duplicates', async () => {
    fetcher.pages.set(
      'https://www.linkedin.com/jobs/view/4012345678',
      fixture('linkedin-guest.html'),
    );
    const shared =
      'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4012345678&trk=x';

    const first = await previewLink(shared);
    expect(fetcher.requested).toEqual(['https://www.linkedin.com/jobs/view/4012345678']);
    expect(first.draft).toMatchObject({
      companyName: 'Initech',
      roleTitle: 'Software Engineer II',
      source: 'LINKEDIN',
      jobUrl: 'https://www.linkedin.com/jobs/view/4012345678',
    });

    // Save it, then share the same job via a different link.
    const saved = await jane
      .post('/api/v1/applications')
      .send({
        companyName: first.draft.companyName,
        roleTitle: first.draft.roleTitle,
        jobUrl: first.draft.jobUrl,
      })
      .expect(201);
    const again = await previewLink(
      'https://linkedin.com/jobs/view/software-engineer-ii-at-initech-4012345678?refId=y',
    );
    expect(again.duplicate).toEqual({
      id: saved.body.id,
      roleTitle: 'Software Engineer II',
      companyName: 'Initech',
    });
  });

  it('explains sign-in walls instead of failing', async () => {
    fetcher.pages.set(
      'https://www.facebook.com/groups/devjobs/posts/123',
      new PageFetchError('sign_in_required', 'This page is only visible when signed in'),
    );
    const preview = await previewLink('https://www.facebook.com/groups/devjobs/posts/123');
    expect(preview).toMatchObject({
      fetched: false,
      draft: {
        source: 'FACEBOOK',
        jobUrl: 'https://facebook.com/groups/devjobs/posts/123',
        roleTitle: null,
      },
    });
    expect(preview.message).toMatch(/^Facebook only shows this job to signed-in users\. .*paste/);
  });

  it('explains sites that refuse automated access, and never echoes refused links', async () => {
    fetcher.pages.set(
      'https://uk.indeed.com/viewjob?jk=abc',
      new PageFetchError('access_denied', 'Status 403', 403),
    );
    const indeed = await previewLink('https://uk.indeed.com/viewjob?jk=abc&from=share');
    expect(indeed.message).toMatch(/^Indeed doesn't allow its job pages to be read automatically/);

    fetcher.pages.set(
      'http://169.254.169.254/latest',
      new PageFetchError('blocked_address', 'Private'),
    );
    const blocked = await previewLink('http://169.254.169.254/latest');
    expect(blocked).toMatchObject({
      message: 'This link cannot be imported.',
      draft: { jobUrl: null },
    });
  });

  it('uses the AI to fill gaps when the page has no structured data', async () => {
    const page = `<html><head><title>Careers</title></head><body><main>${'<p>We are hiring a Site Reliability Engineer to keep our platform running. </p>'.repeat(5)}</main></body></html>`;
    fetcher.pages.set('https://careers.example.com/sre', page);
    ai.result = {
      companyName: 'Example Corp',
      roleTitle: 'Site Reliability Engineer',
      workMode: 'REMOTE',
    };

    const preview = await previewLink('https://careers.example.com/sre');
    expect(ai.calls).toHaveLength(1);
    expect(preview.methods).toContain('AI');
    expect(preview.draft).toMatchObject({ companyName: 'Example Corp', workMode: 'REMOTE' });
    // The page title "Careers" is kept: AI only fills empty fields.
    expect(preview.draft.roleTitle).toBe('Careers');
  });

  it('validates the link', async () => {
    const res = await jane
      .post('/api/v1/job-imports/preview-link')
      .send({ url: 'javascript:alert(1)' })
      .expect(400);
    expect(res.body.issues[0].path).toBe('url');
  });

  describe('pasted text', () => {
    const text =
      'Umbrella Health is hiring a Data Analyst in Dublin (hybrid). Salary €55,000–€65,000 per year. You will build clinical dashboards with SQL and Python.';

    it('extracts a draft with the AI and keeps the text as the description', async () => {
      ai.result = {
        companyName: 'Umbrella Health',
        roleTitle: 'Data Analyst',
        salaryMin: 55000,
        salaryMax: 65000,
        currency: 'EUR',
      };
      const res = await jane
        .post('/api/v1/job-imports/preview-text')
        .send({ text, url: 'https://www.linkedin.com/jobs/view/999999999/?trk=share' })
        .expect(200);
      expect(res.body).toMatchObject({
        methods: ['AI'],
        draft: {
          companyName: 'Umbrella Health',
          roleTitle: 'Data Analyst',
          salaryMin: 55000,
          jobDescription: text,
          source: 'LINKEDIN',
          jobUrl: 'https://www.linkedin.com/jobs/view/999999999',
        },
      });
    });

    it('is unavailable without an AI key', async () => {
      ai.enabled = false;
      await jane.post('/api/v1/job-imports/preview-text').send({ text }).expect(503);
    });

    it('asks for enough text', async () => {
      await jane.post('/api/v1/job-imports/preview-text').send({ text: 'too short' }).expect(400);
    });
  });
});
