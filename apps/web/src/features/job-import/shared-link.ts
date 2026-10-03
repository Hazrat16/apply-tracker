import type { CreateApplicationInput, JobDraft } from '@apply-tracker/shared';

/**
 * The job link inside shared content. Apps put it in different places:
 * the `url` field, or somewhere inside `text` ("Check out this job: https://…").
 */
export function findSharedUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    const match = candidate?.match(/https?:\/\/[^\s<>"']+/i);
    if (match) return match[0].replace(/[.,;:!?)\]]+$/, '');
  }
  return null;
}

/** Draft from the import API → initial values for the application form. */
export function draftToFormValues(draft: JobDraft): Partial<CreateApplicationInput> {
  return {
    status: 'WISHLIST',
    companyName: draft.companyName ?? '',
    roleTitle: draft.roleTitle ?? '',
    location: draft.location ?? '',
    workMode: draft.workMode,
    source: draft.source,
    salaryMin: draft.salaryMin,
    salaryMax: draft.salaryMax,
    currency: draft.currency ?? 'USD',
    jobUrl: draft.jobUrl ?? '',
    jobDescription: draft.jobDescription ?? '',
  };
}
