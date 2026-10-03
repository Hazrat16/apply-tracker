import type { ApplicationSource } from '@apply-tracker/shared';

/** Query parameters that only track where a click came from. */
const TRACKING_PARAMS = [
  /^utm_/,
  /^(fbclid|gclid|msclkid|mc_cid|mc_eid|igshid|si|_hsenc|_hsmi|gh_src|lever-source|lever-origin)$/i,
  /^(ref|refid|ref_src|src|source|trk|trkinfo|trackingid|lipi|origin|from|position|pagenum|ebp|eid|alternatechannel)$/i,
];

const isTracking = (name: string) => TRACKING_PARAMS.some((pattern) => pattern.test(name));

/** Hostname without a leading `www.` / `m.` (e.g. `linkedin.com`). */
export const baseHost = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');

const hostIs = (url: URL, domain: string) => {
  const host = baseHost(url);
  return host === domain || host.endsWith(`.${domain}`);
};

function linkedInJobId(url: URL): string | null {
  const fromPath = url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/);
  return fromPath?.[1] ?? url.searchParams.get('currentJobId');
}

/**
 * Canonical form of a job link, so the same job shared from different places
 * (app, search page, tracking links) is recognised as one job.
 */
export function canonicalJobUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (hostIs(url, 'linkedin.com')) {
    const id = linkedInJobId(url);
    if (id) return `https://www.linkedin.com/jobs/view/${id}`;
  }

  if (hostIs(url, 'indeed.com')) {
    const id = url.searchParams.get('jk') ?? url.searchParams.get('vjk');
    if (id) return `https://${url.hostname.toLowerCase()}/viewjob?jk=${id}`;
  }

  const params = [...url.searchParams.entries()]
    .filter(([name]) => !isTracking(name))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  const path = url.pathname.replace(/\/+$/, '') || '/';

  return `https://${url.hostname.toLowerCase().replace(/^www\./, '')}${path}${query ? `?${query}` : ''}`;
}

/** Applicant tracking systems: the posting is on the company's own careers page. */
const COMPANY_ATS = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workable.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'recruitee.com',
  'personio.de',
  'teamtailor.com',
  'bamboohr.com',
];

const JOB_BOARDS = [
  'glassdoor.com',
  'bdjobs.com',
  'stepstone.de',
  'monster.com',
  'ziprecruiter.com',
  'wellfound.com',
  'remoteok.com',
  'weworkremotely.com',
  'otta.com',
  'welcometothejungle.com',
  'naukri.com',
  'seek.com.au',
  'reed.co.uk',
  'totaljobs.com',
  'dice.com',
  'xing.com',
];

export function detectSource(input: string): ApplicationSource {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return 'OTHER';
  }
  if (hostIs(url, 'linkedin.com') || hostIs(url, 'lnkd.in')) return 'LINKEDIN';
  if (hostIs(url, 'indeed.com')) return 'INDEED';
  if (['facebook.com', 'fb.com', 'fb.me', 'fb.watch'].some((d) => hostIs(url, d)))
    return 'FACEBOOK';
  if (COMPANY_ATS.some((d) => hostIs(url, d))) return 'COMPANY_WEBSITE';
  if (JOB_BOARDS.some((d) => hostIs(url, d))) return 'JOB_BOARD';
  return 'OTHER';
}

/**
 * The link to store with the application: tracking parameters removed, but the original
 * scheme kept (canonical URLs always use https and are only for matching duplicates).
 */
export function cleanJobUrl(input: string): string | null {
  const canonical = canonicalJobUrl(input);
  if (!canonical) return null;
  return new URL(input).protocol === 'http:' ? canonical.replace(/^https:/, 'http:') : canonical;
}

/** The page we fetch for a link: the canonical public page when we know one. */
export function fetchableUrl(input: string): string {
  const canonical = canonicalJobUrl(input);
  const url = new URL(input);
  return hostIs(url, 'linkedin.com') || hostIs(url, 'indeed.com') ? (canonical ?? input) : input;
}
