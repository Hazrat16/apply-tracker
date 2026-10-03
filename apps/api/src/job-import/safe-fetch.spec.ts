import { Headers, Response } from 'undici';
import {
  assertFetchableUrl,
  isPublicAddress,
  PageFetchError,
  SafePageFetcher,
} from './safe-fetch.js';

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '151.101.1.69', '2606:4700::6810:84e5'])('allows public %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata endpoint
    '100.64.0.1', // carrier-grade NAT
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});

describe('assertFetchableUrl', () => {
  const reason = (url: string) => {
    try {
      assertFetchableUrl(url);
      return 'ok';
    } catch (error) {
      return (error as PageFetchError).reason;
    }
  };

  it.each([
    ['https://example.com/jobs/1', 'ok'],
    ['http://example.com:80/jobs', 'ok'],
    ['ftp://example.com/file', 'invalid_url'],
    ['file:///etc/passwd', 'invalid_url'],
    ['https://user:pass@example.com/', 'invalid_url'],
    ['https://example.com:8080/', 'blocked_address'],
    ['http://127.0.0.1/', 'blocked_address'],
    ['http://[::1]/', 'blocked_address'],
    ['http://169.254.169.254/latest/meta-data', 'blocked_address'],
    ['http://localhost/', 'blocked_address'],
    ['http://metadata.google.internal/', 'blocked_address'],
  ])('%s → %s', (url, expected) => {
    expect(reason(url)).toBe(expected);
  });
});

/** Fetcher whose HTTP layer is scripted, to test redirect and response handling offline. */
class ScriptedFetcher extends SafePageFetcher {
  readonly requested: string[] = [];
  constructor(private readonly responses: Response[]) {
    super();
  }
  protected override request(url: URL): Promise<Response> {
    this.requested.push(url.toString());
    return Promise.resolve(this.responses.shift()!);
  }
}

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
const redirect = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } });

describe('SafePageFetcher', () => {
  const reasonOf = (promise: Promise<unknown>) =>
    promise.then(
      () => 'ok',
      (error: PageFetchError) => error.reason,
    );

  it('follows redirects and returns the final page', async () => {
    const fetcher = new ScriptedFetcher([redirect('/jobs/2'), html('<h1>Job</h1>')]);
    await expect(fetcher.fetchPage('https://example.com/jobs/1')).resolves.toEqual({
      url: 'https://example.com/jobs/2',
      html: '<h1>Job</h1>',
    });
    await fetcher.onModuleDestroy();
  });

  it('refuses a redirect to a private address', async () => {
    const fetcher = new ScriptedFetcher([redirect('http://169.254.169.254/latest/meta-data')]);
    expect(await reasonOf(fetcher.fetchPage('https://example.com/jobs/1'))).toBe('blocked_address');
    await fetcher.onModuleDestroy();
  });

  it('detects sign-in walls and refused automated access', async () => {
    const wall = new ScriptedFetcher([redirect('https://www.linkedin.com/authwall?trk=x')]);
    expect(await reasonOf(wall.fetchPage('https://www.linkedin.com/jobs/view/1'))).toBe(
      'sign_in_required',
    );
    // `new Response` only allows 200–599, so LinkedIn's non-standard 999 is a plain object.
    const response999 = {
      status: 999,
      ok: false,
      headers: new Headers(),
      body: null,
    } as unknown as Response;
    const status999 = new ScriptedFetcher([response999]);
    expect(await reasonOf(status999.fetchPage('https://www.linkedin.com/jobs/view/1'))).toBe(
      'access_denied',
    );
  });

  it('stops after too many redirects', async () => {
    const fetcher = new ScriptedFetcher(Array.from({ length: 7 }, (_, i) => redirect(`/r${i}`)));
    expect(await reasonOf(fetcher.fetchPage('https://example.com/'))).toBe('http_error');
  });

  it('rejects non-HTML and oversized responses', async () => {
    const pdf = new ScriptedFetcher([html('%PDF', { 'content-type': 'application/pdf' })]);
    expect(await reasonOf(pdf.fetchPage('https://example.com/a.pdf'))).toBe('not_html');
    const big = new ScriptedFetcher([html('x', { 'content-length': String(10 * 1024 * 1024) })]);
    expect(await reasonOf(big.fetchPage('https://example.com/'))).toBe('too_large');
  });

  it('refuses to resolve hostnames that point at private addresses', async () => {
    // Real DNS + connect path: "localhost.example" style tricks are caught by safeLookup;
    // here a name that resolves to loopback must never be connected to.
    const fetcher = new SafePageFetcher();
    expect(await reasonOf(fetcher.fetchPage('http://127.0.0.1.nip.io/'))).toMatch(
      /blocked_address|network/,
    );
    await fetcher.onModuleDestroy();
  });
});
