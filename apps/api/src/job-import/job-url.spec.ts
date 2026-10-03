import { canonicalJobUrl, cleanJobUrl, detectSource, fetchableUrl } from './job-url.js';

describe('canonicalJobUrl', () => {
  it.each([
    'https://www.linkedin.com/jobs/view/4012345678/?trk=public_jobs&refId=abc',
    'https://linkedin.com/jobs/view/senior-backend-engineer-at-acme-4012345678',
    'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4012345678',
    'https://m.linkedin.com/jobs/search/?currentJobId=4012345678&geoId=1',
  ])('canonicalises the LinkedIn job link %s', (url) => {
    expect(canonicalJobUrl(url)).toBe('https://www.linkedin.com/jobs/view/4012345678');
  });

  it('canonicalises Indeed links to the job key', () => {
    expect(canonicalJobUrl('https://de.indeed.com/viewjob?jk=abc123&from=serp&vjs=3')).toBe(
      'https://de.indeed.com/viewjob?jk=abc123',
    );
    expect(canonicalJobUrl('https://www.indeed.com/jobs?q=dev&vjk=abc123')).toBe(
      'https://www.indeed.com/viewjob?jk=abc123',
    );
  });

  it('removes tracking parameters, fragments and trailing slashes, and sorts the rest', () => {
    expect(
      canonicalJobUrl('https://www.Acme.com/careers/jobs/42/?utm_source=x&b=2&gclid=y&a=1#apply'),
    ).toBe('https://acme.com/careers/jobs/42?a=1&b=2');
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(canonicalJobUrl('not a url')).toBeNull();
    expect(canonicalJobUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('detectSource', () => {
  it.each([
    ['https://www.linkedin.com/jobs/view/1', 'LINKEDIN'],
    ['https://lnkd.in/abc', 'LINKEDIN'],
    ['https://uk.indeed.com/viewjob?jk=1', 'INDEED'],
    ['https://m.facebook.com/groups/123/posts/456', 'FACEBOOK'],
    ['https://boards.greenhouse.io/acme/jobs/1', 'COMPANY_WEBSITE'],
    ['https://jobs.bdjobs.com/jobdetails.asp?id=1', 'JOB_BOARD'],
    ['https://acme.com/careers/1', 'OTHER'],
  ] as const)('%s → %s', (url, source) => {
    expect(detectSource(url)).toBe(source);
  });
});

describe('fetchableUrl', () => {
  it('fetches the public LinkedIn job page for any LinkedIn job link', () => {
    expect(fetchableUrl('https://www.linkedin.com/jobs/search/?currentJobId=4012345678')).toBe(
      'https://www.linkedin.com/jobs/view/4012345678',
    );
  });

  it('keeps other links as they are', () => {
    expect(fetchableUrl('https://acme.com/jobs/1?utm_source=x')).toBe(
      'https://acme.com/jobs/1?utm_source=x',
    );
  });
});

describe('cleanJobUrl', () => {
  it('removes tracking but keeps the scheme', () => {
    expect(cleanJobUrl('http://jobs.example.com/42?utm_medium=x&gh_src=y')).toBe(
      'http://jobs.example.com/42',
    );
    expect(cleanJobUrl('https://job-boards.greenhouse.io/acme/jobs/1?gh_src=abc')).toBe(
      'https://job-boards.greenhouse.io/acme/jobs/1',
    );
  });
});
