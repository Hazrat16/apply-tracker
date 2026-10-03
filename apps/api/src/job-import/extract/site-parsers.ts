import type { CheerioAPI } from 'cheerio';
import { clean, htmlToText } from './html-text.js';
import { type DraftPart, inferWorkMode } from './types.js';

/** LinkedIn's public (signed-out) job page. */
function linkedIn($: CheerioAPI): DraftPart | null {
  const roleTitle = clean($('.top-card-layout__title, .topcard__title').first().text());
  if (!roleTitle) return null;
  const location = clean($('.topcard__flavor--bullet').first().text());
  const descriptionHtml = $('.show-more-less-html__markup, .description__text').first().html();
  return {
    roleTitle,
    companyName: clean($('.topcard__org-name-link, .topcard__flavor a').first().text()),
    location,
    workMode: inferWorkMode(roleTitle, location),
    jobDescription: descriptionHtml ? htmlToText(descriptionHtml) : null,
  };
}

function indeed($: CheerioAPI): DraftPart | null {
  const title = $(
    'h1.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"]',
  ).first();
  if (!title.length) return null;
  // Indeed appends " - job post" in a nested span.
  const roleTitle = clean(title.text().replace(/\s*-\s*job post\s*$/i, ''));
  const location = clean(
    $('[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]').first().text(),
  );
  const descriptionHtml = $('#jobDescriptionText').html();
  return {
    roleTitle,
    companyName: clean(
      $('[data-company-name="true"], [data-testid="inlineHeader-companyName"]').first().text(),
    ),
    location,
    workMode: inferWorkMode(roleTitle, location),
    jobDescription: descriptionHtml ? htmlToText(descriptionHtml) : null,
  };
}

/** Greenhouse job boards (job-boards.greenhouse.io and boards.greenhouse.io). */
function greenhouse($: CheerioAPI): DraftPart | null {
  const roleTitle = clean($('.job__title h1, .app-title').first().text());
  if (!roleTitle) return null;
  const location = clean($('.job__location, .location').first().text());
  const descriptionHtml = $('.job__description, #content').first().html();
  // The page title reads "Job Application for <role> at <company>".
  const companyName = clean(
    $('title')
      .text()
      .match(/ at (.+)$/)?.[1],
  );
  return {
    roleTitle,
    companyName,
    location,
    workMode: inferWorkMode(roleTitle, location),
    jobDescription: descriptionHtml ? htmlToText(descriptionHtml) : null,
  };
}

const PARSERS: [RegExp, ($: CheerioAPI) => DraftPart | null][] = [
  [/(^|\.)greenhouse\.io$/, greenhouse],
  [/(^|\.)linkedin\.com$/, linkedIn],
  [/(^|\.)indeed\.com$/, indeed],
];

/** Site-specific parsing for big job sites whose pages lack structured data. */
export function extractSiteSpecific($: CheerioAPI, url: URL): DraftPart | null {
  const host = url.hostname.toLowerCase();
  return PARSERS.find(([pattern]) => pattern.test(host))?.[1]($) ?? null;
}
