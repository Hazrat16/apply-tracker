import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each(['/settings', '/dashboard?tab=1'])('allows the same-site path %s', (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('falls back for %s', (path) => {
    expect(safeRedirectPath(path)).toBe('/dashboard');
  });
});
