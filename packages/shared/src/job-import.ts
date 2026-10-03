import { z } from 'zod';
import { applicationSourceSchema, workModeSchema } from './application.js';

const httpUrl = z
  .string()
  .trim()
  .min(1, 'Paste a link to the job posting')
  .max(2000)
  .pipe(z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) link' }));

export const jobLinkInputSchema = z.object({ url: httpUrl });
export type JobLinkInput = z.infer<typeof jobLinkInputSchema>;

export const jobTextInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(80, 'Paste more of the job posting (at least a few sentences)')
    .max(50_000, 'That is too long — paste just the job posting'),
  /** Link the text came from, if any (kept as the job URL). */
  url: httpUrl.optional(),
});
export type JobTextInput = z.infer<typeof jobTextInputSchema>;

/** How each part of a draft was found, most reliable first. */
export const JOB_EXTRACTION_METHODS = [
  'STRUCTURED_DATA',
  'PAGE_CONTENT',
  'META_TAGS',
  'AI',
] as const;
export const jobExtractionMethodSchema = z.enum(JOB_EXTRACTION_METHODS);
export type JobExtractionMethod = z.infer<typeof jobExtractionMethodSchema>;

/** Application fields found in a job posting. Anything not found is `null`. */
export const jobDraftSchema = z.object({
  companyName: z.string().nullable(),
  roleTitle: z.string().nullable(),
  location: z.string().nullable(),
  workMode: workModeSchema.nullable(),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  currency: z.string().nullable(),
  jobDescription: z.string().nullable(),
  jobUrl: z.string().nullable(),
  source: applicationSourceSchema.nullable(),
});
export type JobDraft = z.infer<typeof jobDraftSchema>;

export const jobPreviewSchema = z.object({
  draft: jobDraftSchema,
  methods: z.array(jobExtractionMethodSchema),
  /** Whether the page itself could be read (false: sign-in wall, blocked, offline…). */
  fetched: z.boolean(),
  /** Explanation for the user when something could not be read. */
  message: z.string().nullable(),
  /** An application the user already saved for the same job link. */
  duplicate: z
    .object({ id: z.string(), roleTitle: z.string(), companyName: z.string() })
    .nullable(),
});
export type JobPreview = z.infer<typeof jobPreviewSchema>;

export const jobImportCapabilitiesSchema = z.object({
  /** AI extraction from pasted text is available (server has an API key). */
  ai: z.boolean(),
});
export type JobImportCapabilities = z.infer<typeof jobImportCapabilitiesSchema>;
