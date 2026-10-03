import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  ApplicationSource,
  JobDraft,
  JobExtractionMethod,
  JobImportCapabilities,
  JobPreview,
  JobTextInput,
} from '@apply-tracker/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiJobExtractor } from './ai-job-extractor.js';
import { extractFromHtml } from './extract/extract.js';
import { htmlToText } from './extract/html-text.js';
import { type DraftPart, mergeDraft } from './extract/types.js';
import { canonicalJobUrl, cleanJobUrl, detectSource, fetchableUrl } from './job-url.js';
import { type PageFetchFailure, PageFetchError, SafePageFetcher } from './safe-fetch.js';

/** Ask the AI only when the page has a reasonable amount of text. */
const MIN_TEXT_FOR_AI = 200;

const SITE_NAMES: Partial<Record<ApplicationSource, string>> = {
  LINKEDIN: 'LinkedIn',
  FACEBOOK: 'Facebook',
  INDEED: 'Indeed',
};

const EMPTY_DRAFT: JobDraft = {
  companyName: null,
  roleTitle: null,
  location: null,
  workMode: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
  jobDescription: null,
  jobUrl: null,
  source: null,
};

@Injectable()
export class JobImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: SafePageFetcher,
    private readonly ai: AiJobExtractor,
  ) {}

  capabilities(): JobImportCapabilities {
    return { ai: this.ai.enabled };
  }

  /** Reads a job link and returns a draft for the user to review — nothing is saved. */
  async previewLink(userId: string, url: string): Promise<JobPreview> {
    const source = detectSource(url);
    const canonical = canonicalJobUrl(url);
    const draft: DraftPart = { jobUrl: cleanJobUrl(url) ?? url, source };
    const methods: JobExtractionMethod[] = [];
    let fetched = false;
    let message: string | null = null;
    let pageText = '';

    try {
      const page = await this.fetcher.fetchPage(fetchableUrl(url));
      fetched = true;
      const extraction = extractFromHtml(page.html, new URL(page.url));
      mergeDraft(draft, extraction.draft);
      methods.push(...extraction.methods);
      pageText = extraction.text;
    } catch (error) {
      if (!(error instanceof PageFetchError)) throw error;
      message = this.fetchFailureMessage(error.reason, source);
      // Don't hand a refused (e.g. private-network) link back as the job link.
      if (error.reason === 'blocked_address' || error.reason === 'invalid_url') draft.jobUrl = null;
    }

    const missingEssentials = !draft.companyName || !draft.roleTitle;
    if (fetched && missingEssentials && this.ai.enabled && pageText.length >= MIN_TEXT_FOR_AI) {
      const part = await this.ai.extract(pageText, url);
      if (part && mergeDraft(draft, part)) methods.push('AI');
    }

    if (fetched && (!draft.companyName || !draft.roleTitle)) {
      message = this.ai.enabled
        ? "We couldn't find all the job details on that page. Check the fields below, or paste the job text instead."
        : "We couldn't find all the job details on that page. Fill in the missing fields below.";
    }

    return {
      draft: { ...EMPTY_DRAFT, ...draft },
      methods,
      fetched,
      message,
      duplicate: await this.findDuplicate(userId, canonical),
    };
  }

  /** Extracts a draft from job text the user pasted (e.g. from a page that needs sign-in). */
  async previewText(userId: string, input: JobTextInput): Promise<JobPreview> {
    if (!this.ai.enabled) {
      throw new ServiceUnavailableException(
        'Reading pasted job text is not enabled on this server',
      );
    }
    const part = await this.ai.extract(input.text, input.url);
    if (!part)
      throw new BadGatewayException("We couldn't analyse that text right now. Please try again.");

    const canonical = input.url ? canonicalJobUrl(input.url) : null;
    const draft: DraftPart = {
      jobUrl: input.url ? cleanJobUrl(input.url) : null,
      source: input.url ? detectSource(input.url) : null,
      // The pasted text itself is the most faithful job description.
      jobDescription: htmlToText(input.text.replace(/\n/g, '<br>')),
    };
    mergeDraft(draft, part);

    return {
      draft: { ...EMPTY_DRAFT, ...draft },
      methods: ['AI'],
      fetched: false,
      message: null,
      duplicate: await this.findDuplicate(userId, canonical),
    };
  }

  private async findDuplicate(
    userId: string,
    canonical: string | null,
  ): Promise<JobPreview['duplicate']> {
    if (!canonical) return null;
    const existing = await this.prisma.application.findFirst({
      where: { userId, canonicalJobUrl: canonical },
      select: { id: true, roleTitle: true, company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return existing
      ? { id: existing.id, roleTitle: existing.roleTitle, companyName: existing.company.name }
      : null;
  }

  private fetchFailureMessage(reason: PageFetchFailure, source: ApplicationSource): string {
    const site = SITE_NAMES[source] ?? 'This site';
    const pasteHint = this.ai.enabled
      ? 'Open the job, copy its description and paste it here instead.'
      : 'Fill in the details below — the link will be saved with the application.';
    switch (reason) {
      case 'sign_in_required':
        return `${site} only shows this job to signed-in users. ${pasteHint}`;
      case 'access_denied':
        return `${site} doesn't allow its job pages to be read automatically. ${pasteHint}`;
      case 'blocked_address':
      case 'invalid_url':
        return 'This link cannot be imported.';
      case 'not_html':
        return "That link doesn't point to a web page.";
      case 'too_large':
        return 'That page is too large to read.';
      default:
        return `We couldn't load that page right now. ${pasteHint}`;
    }
  }
}
