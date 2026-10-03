import type { JobExtractionMethod } from '@apply-tracker/shared';
import { load } from 'cheerio';
import { pageText } from './html-text.js';
import { extractJsonLd } from './json-ld.js';
import { extractMetaTags } from './meta-tags.js';
import { extractSiteSpecific } from './site-parsers.js';
import { type DraftPart, mergeDraft } from './types.js';

export interface PageExtraction {
  draft: DraftPart;
  methods: JobExtractionMethod[];
  /** Readable page text, for the optional AI pass. */
  text: string;
}

/** Runs the extractors from most to least reliable; later ones only fill gaps. */
export function extractFromHtml(html: string, url: URL): PageExtraction {
  const $ = load(html);
  const draft: DraftPart = {};
  const methods: JobExtractionMethod[] = [];

  const steps: [JobExtractionMethod, DraftPart | null][] = [
    ['STRUCTURED_DATA', extractJsonLd($)],
    ['PAGE_CONTENT', extractSiteSpecific($, url)],
    ['META_TAGS', extractMetaTags($)],
  ];
  for (const [method, part] of steps) {
    if (part && mergeDraft(draft, part)) methods.push(method);
  }

  return { draft, methods, text: pageText($) };
}
