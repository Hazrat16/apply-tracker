import type { CheerioAPI } from 'cheerio';
import { clean } from './html-text.js';
import { type DraftPart, inferWorkMode } from './types.js';

const meta = ($: CheerioAPI, ...names: string[]) => {
  for (const name of names) {
    const value = clean($(`meta[property="${name}"], meta[name="${name}"]`).attr('content'));
    if (value) return value;
  }
  return null;
};

/** Open Graph / meta tags: present on almost every page, but only roughly structured. */
export function extractMetaTags($: CheerioAPI): DraftPart {
  const title = meta($, 'og:title', 'twitter:title') ?? clean($('title').first().text());
  const description = meta($, 'og:description', 'description', 'twitter:description');

  // LinkedIn: "Initech hiring Software Engineer II in London, England, United Kingdom | LinkedIn"
  const linkedIn = title?.match(/^(.+?) hiring (.+?)(?: in (.+?))? \| LinkedIn$/);
  if (linkedIn) {
    const [, companyName, roleTitle, location] = linkedIn;
    return {
      companyName: companyName ?? null,
      roleTitle: roleTitle ?? null,
      location: location ?? null,
      workMode: inferWorkMode(roleTitle, location),
    };
  }

  // Common "Role at Company" page titles. The <title> element is used too, but only when it
  // names the same role as the meta title (e.g. Greenhouse), so "Careers at Acme" isn't a role.
  const roleAtPattern = /^(?:Job Application for )?(.+?)\s+(?:at|@)\s+(.+?)(?:\s+[|–-].*)?$/i;
  const pageTitleMatch = clean($('title').first().text())?.match(roleAtPattern);
  const roleAt =
    title?.match(roleAtPattern) ??
    (pageTitleMatch && (!title || pageTitleMatch[1] === title) ? pageTitleMatch : null);
  return {
    roleTitle: roleAt?.[1] ?? title,
    companyName: roleAt?.[2] ?? meta($, 'og:site_name'),
    workMode: inferWorkMode(title),
    jobDescription: description,
  };
}
