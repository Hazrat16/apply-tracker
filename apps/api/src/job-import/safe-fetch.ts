import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { isIP } from 'node:net';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import ipaddr from 'ipaddr.js';
import { Agent, fetch, type Response } from 'undici';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (compatible; ApplyTrackerLinkPreview/1.0; +https://github.com/apply-tracker)';

export type PageFetchFailure =
  | 'invalid_url'
  | 'blocked_address'
  | 'sign_in_required'
  | 'access_denied'
  | 'http_error'
  | 'not_html'
  | 'too_large'
  | 'timeout'
  | 'network';

export class PageFetchError extends Error {
  constructor(
    readonly reason: PageFetchFailure,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PageFetchError';
  }
}

export interface FetchedPage {
  /** URL after redirects. */
  url: string;
  html: string;
}

/** Only globally routable addresses: no loopback, private, link-local (cloud metadata), CGNAT, multicast… */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  // `process` turns IPv4-mapped IPv6 (::ffff:10.0.0.1) back into IPv4 before classifying.
  return ipaddr.process(address).range() === 'unicast';
}

/** DNS lookup that refuses to connect to non-public addresses (also defeats DNS rebinding). */
function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
): void {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(
        new PageFetchError('blocked_address', 'This link points to a private network address'),
        [],
      );
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

/** Checks a URL before each request, including every redirect hop. */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageFetchError('invalid_url', 'That is not a valid link');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PageFetchError('invalid_url', 'Only http and https links can be imported');
  }
  if (url.username || url.password) {
    throw new PageFetchError('invalid_url', 'Links with embedded credentials are not allowed');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new PageFetchError('blocked_address', 'Links to non-standard ports are not allowed');
  }
  // IP literals skip DNS, so they are checked here (brackets are stripped from IPv6 hosts).
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) {
    throw new PageFetchError('blocked_address', 'This link points to a private network address');
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new PageFetchError('blocked_address', 'This link points to a private network address');
  }
  return url;
}

const SIGN_IN_PATH = /\/(login|signin|sign-in|authwall|checkpoint|uas\/login|accounts\/login)\b/i;

/**
 * Fetches one public web page on behalf of a user, defensively: public addresses only,
 * limited redirects, time and size limits, HTML only.
 */
@Injectable()
export class SafePageFetcher implements OnModuleDestroy {
  private readonly agent = new Agent({
    connect: { lookup: safeLookup, timeout: TIMEOUT_MS },
    headersTimeout: TIMEOUT_MS,
    bodyTimeout: TIMEOUT_MS,
  });

  async fetchPage(raw: string): Promise<FetchedPage> {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let url = assertFetchableUrl(raw);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await this.request(url, signal);

      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        await response.body?.cancel();
        url = assertFetchableUrl(new URL(response.headers.get('location')!, url).toString());
        if (SIGN_IN_PATH.test(url.pathname)) {
          throw new PageFetchError('sign_in_required', 'This page is only visible when signed in');
        }
        continue;
      }

      if (SIGN_IN_PATH.test(url.pathname)) {
        throw new PageFetchError('sign_in_required', 'This page is only visible when signed in');
      }
      if (!response.ok) {
        await response.body?.cancel();
        // Sites that refuse automated reads answer 401/403/429, or 999 (LinkedIn).
        const reason = [401, 403, 429, 999].includes(response.status)
          ? 'access_denied'
          : 'http_error';
        throw new PageFetchError(
          reason,
          `The site responded with status ${response.status}`,
          response.status,
        );
      }

      const type = response.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
        await response.body?.cancel();
        throw new PageFetchError('not_html', 'That link is not a web page');
      }

      return { url: url.toString(), html: await this.readText(response, type) };
    }

    throw new PageFetchError('http_error', 'Too many redirects');
  }

  async onModuleDestroy(): Promise<void> {
    await this.agent.close();
  }

  /** One HTTP request without following redirects. Overridable in tests. */
  protected async request(url: URL, signal: AbortSignal): Promise<Response> {
    try {
      return await fetch(url, {
        dispatcher: this.agent,
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en;q=0.9,*;q=0.5',
        },
      });
    } catch (error) {
      throw this.toFetchError(error);
    }
  }

  private async readText(response: Response, contentType: string): Promise<string> {
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_BYTES) throw new PageFetchError('too_large', 'That page is too large');

    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const chunk of response.body ?? []) {
        size += chunk.byteLength;
        if (size > MAX_BYTES) throw new PageFetchError('too_large', 'That page is too large');
        chunks.push(chunk);
      }
    } catch (error) {
      throw error instanceof PageFetchError ? error : this.toFetchError(error);
    }

    const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8';
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charset);
    } catch {
      decoder = new TextDecoder('utf-8');
    }
    return decoder.decode(Buffer.concat(chunks));
  }

  private toFetchError(error: unknown): PageFetchError {
    if (error instanceof PageFetchError) return error;
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof PageFetchError) return cause;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return new PageFetchError('timeout', 'The site took too long to respond');
    }
    return new PageFetchError('network', 'The site could not be reached');
  }
}
