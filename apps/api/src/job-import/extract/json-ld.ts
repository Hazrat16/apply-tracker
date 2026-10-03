import type { CheerioAPI } from 'cheerio';
import { clean, decodeHtmlText } from './html-text.js';
import { type DraftPart, inferWorkMode } from './types.js';

type Json = Record<string, unknown>;

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const isJobPosting = (node: Json) =>
  asArray(node['@type'] as string | string[]).some((type) => type === 'JobPosting');

/** All JSON-LD objects on the page, flattening arrays and `@graph`. */
function jsonLdNodes($: CheerioAPI): Json[] {
  const nodes: Json[] = [];
  const visit = (value: unknown) => {
    for (const item of asArray(value)) {
      if (item && typeof item === 'object') {
        nodes.push(item as Json);
        if ('@graph' in item) visit((item as Json)['@graph']);
      }
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).text()));
    } catch {
      // Malformed JSON-LD is common on the web; ignore that block.
    }
  });
  return nodes;
}

const nameOf = (value: unknown): string | null =>
  typeof value === 'string'
    ? clean(decodeHtmlText(value))
    : value && typeof value === 'object'
      ? nameOf((value as Json).name)
      : null;

function location(posting: Json): string | null {
  const places = asArray(posting.jobLocation as Json | Json[]).map((place) => {
    const address = (place?.address ?? {}) as Json | string;
    if (typeof address === 'string') return clean(address);
    const parts = [address.addressLocality, address.addressRegion, nameOf(address.addressCountry)]
      .map((part) => (typeof part === 'string' ? clean(part) : null))
      .filter((part): part is string => !!part);
    return [...new Set(parts)].join(', ') || null;
  });
  const onSite = places.filter(Boolean).join(' / ');
  if (onSite) return onSite;

  if (posting.jobLocationType === 'TELECOMMUTE') {
    const region = asArray(posting.applicantLocationRequirements as Json | Json[])
      .map(nameOf)
      .filter(Boolean)
      .join(', ');
    return region ? `Remote (${region})` : 'Remote';
  }
  return null;
}

/** Converts a salary to a yearly figure, the unit the app stores. */
const PER_YEAR: Record<string, number> = { YEAR: 1, MONTH: 12, WEEK: 52, DAY: 260, HOUR: 2080 };

function salary(posting: Json): Pick<DraftPart, 'salaryMin' | 'salaryMax' | 'currency'> {
  const amount = posting.baseSalary as Json | undefined;
  if (!amount || typeof amount !== 'object') return {};
  const value = (amount.value ?? {}) as Json | number;
  const unit =
    typeof value === 'object' && typeof value.unitText === 'string'
      ? value.unitText.toUpperCase()
      : 'YEAR';
  const factor = PER_YEAR[unit];
  if (!factor) return {};

  const number = (raw: unknown) => {
    const parsed = typeof raw === 'string' ? Number(raw.replace(/[^\d.]/g, '')) : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * factor) : null;
  };
  const exact = typeof value === 'number' ? number(value) : number(value.value);
  const min = typeof value === 'object' ? (number(value.minValue) ?? exact) : exact;
  const max = typeof value === 'object' ? (number(value.maxValue) ?? exact) : exact;
  const currency =
    typeof amount.currency === 'string' && /^[A-Z]{3}$/i.test(amount.currency)
      ? amount.currency.toUpperCase()
      : null;
  return min || max ? { salaryMin: min, salaryMax: max, currency } : {};
}

/** schema.org `JobPosting` structured data — the most reliable source when a site provides it. */
export function extractJsonLd($: CheerioAPI): DraftPart | null {
  const posting = jsonLdNodes($).find(isJobPosting);
  if (!posting) return null;

  const roleTitle = nameOf(posting.title);
  const place = location(posting);
  return {
    roleTitle,
    companyName: nameOf(posting.hiringOrganization),
    location: place,
    workMode:
      posting.jobLocationType === 'TELECOMMUTE' ? 'REMOTE' : inferWorkMode(roleTitle, place),
    jobDescription:
      typeof posting.description === 'string' ? decodeHtmlText(posting.description) || null : null,
    ...salary(posting),
  };
}
