import { findSharedUrl } from './shared-link';

describe('findSharedUrl', () => {
  it('prefers the url field', () => {
    expect(findSharedUrl('https://a.example/job', 'see https://b.example')).toBe(
      'https://a.example/job',
    );
  });

  it('finds a link inside shared text and trims trailing punctuation', () => {
    expect(
      findSharedUrl(
        null,
        'Check out this job at Acme: https://www.linkedin.com/jobs/view/123/?trk=x.',
      ),
    ).toBe('https://www.linkedin.com/jobs/view/123/?trk=x');
  });

  it('returns null when nothing looks like a link', () => {
    expect(findSharedUrl(undefined, 'Senior engineer role', '')).toBeNull();
  });
});
