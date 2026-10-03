import { readFileSync } from 'node:fs';
import { extractFromHtml } from './extract.js';
import { htmlToText } from './html-text.js';

const fixture = (name: string) =>
  readFileSync(new URL(`../../../test/fixtures/job-pages/${name}`, import.meta.url), 'utf8');

describe('extractFromHtml', () => {
  it('reads schema.org JobPosting data (Greenhouse-style page)', () => {
    const { draft, methods } = extractFromHtml(
      fixture('greenhouse-json-ld.html'),
      new URL('https://boards.greenhouse.io/acme/jobs/1'),
    );
    expect(draft).toMatchObject({
      roleTitle: 'Senior Backend Engineer & Platform',
      companyName: 'Acme Robotics',
      location: 'Berlin, DE',
      salaryMin: 75000,
      salaryMax: 90000,
      currency: 'EUR',
    });
    expect(draft.workMode ?? null).toBeNull(); // not stated, so not guessed
    expect(draft.jobDescription).toBe('We build warehouse robots.\n• Node.js\n• PostgreSQL');
    expect(methods[0]).toBe('STRUCTURED_DATA');
  });

  it('handles @graph, remote jobs and hourly pay, and skips broken JSON-LD', () => {
    const { draft } = extractFromHtml(
      fixture('graph-remote-hourly.html'),
      new URL('https://globex.example/jobs/9'),
    );
    expect(draft).toMatchObject({
      roleTitle: 'Support Engineer',
      companyName: 'Globex',
      location: 'Remote (Canada)',
      workMode: 'REMOTE',
      salaryMin: 83200, // 40/h × 2080 h
      salaryMax: 83200,
      currency: 'CAD',
      jobDescription: 'Help our customers.\nShifts are flexible.',
    });
  });

  it("parses LinkedIn's public job page", () => {
    const { draft, methods } = extractFromHtml(
      fixture('linkedin-guest.html'),
      new URL('https://www.linkedin.com/jobs/view/4012345678'),
    );
    expect(draft).toMatchObject({
      roleTitle: 'Software Engineer II',
      companyName: 'Initech',
      location: 'London, England, United Kingdom',
    });
    expect(draft.jobDescription).toContain('• Build payment APIs');
    expect(methods).toEqual(['PAGE_CONTENT']);
  });

  it('parses Greenhouse job boards', () => {
    const { draft, methods } = extractFromHtml(
      fixture('greenhouse-board.html'),
      new URL('https://job-boards.greenhouse.io/northwind/jobs/123'),
    );
    expect(draft).toMatchObject({
      roleTitle: 'Platform Engineer, Payments & Billing',
      companyName: 'Northwind Labs',
      location: 'Berlin, Germany; Remote-Friendly, Europe',
      workMode: 'REMOTE',
      jobDescription: 'About us\nWe move money for small businesses.\n• TypeScript\n• Kafka',
    });
    expect(methods).toEqual(['PAGE_CONTENT']);
  });

  it("parses Indeed's job page", () => {
    const { draft } = extractFromHtml(
      fixture('indeed.html'),
      new URL('https://uk.indeed.com/viewjob?jk=1'),
    );
    expect(draft).toMatchObject({
      roleTitle: 'Frontend Developer',
      companyName: 'Hooli',
      location: 'Remote',
      workMode: 'REMOTE',
      jobDescription: 'Join our design systems team.',
    });
  });

  it('falls back to meta tags', () => {
    const { draft, methods, text } = extractFromHtml(
      fixture('meta-only.html'),
      new URL('https://umbrella.example/careers/7'),
    );
    expect(draft).toMatchObject({
      roleTitle: 'Data Analyst (Hybrid, Dublin)',
      companyName: 'Umbrella Health',
      workMode: 'HYBRID',
      jobDescription: 'Umbrella Health is hiring a data analyst to work on clinical dashboards.',
    });
    expect(methods).toEqual(['META_TAGS']);
    expect(text).toBe('Lots of text about the role.');
  });

  it('reads "Role at Company" from the <title> when it names the same role as og:title', () => {
    const html =
      '<title>Job Application for Data Engineer at Globex</title><meta property="og:title" content="Data Engineer">';
    expect(extractFromHtml(html, new URL('https://example.com/')).draft).toMatchObject({
      roleTitle: 'Data Engineer',
      companyName: 'Globex',
    });
  });

  it('reads LinkedIn page titles when the page body is missing', () => {
    const html = '<title>Initech hiring Software Engineer II in London | LinkedIn</title>';
    const { draft } = extractFromHtml(html, new URL('https://example.com/'));
    expect(draft).toMatchObject({
      companyName: 'Initech',
      roleTitle: 'Software Engineer II',
      location: 'London',
    });
  });
});

describe('htmlToText', () => {
  it('keeps paragraphs and bullets, drops scripts', () => {
    expect(
      htmlToText('<p>Hello <b>world</b></p><script>x()</script><ul><li>a</li><li>b</li></ul>'),
    ).toBe('Hello world\n• a\n• b');
  });
});
