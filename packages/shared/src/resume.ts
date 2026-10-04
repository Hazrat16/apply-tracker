import { z } from 'zod';

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_MAX_PER_USER = 10;

export const resumeLabelSchema = z
  .string()
  .trim()
  .min(1, 'Give the resume a name')
  .max(80, 'Keep the name under 80 characters');

export const updateResumeSchema = z.object({ label: resumeLabelSchema });
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;

export const resumeSchema = z.object({
  id: z.string(),
  label: z.string(),
  fileName: z.string(),
  sizeBytes: z.number().int(),
  pageCount: z.number().int(),
  /** False for scanned PDFs without selectable text — AI features can't read those. */
  hasText: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Resume = z.infer<typeof resumeSchema>;

export const resumeDetailSchema = resumeSchema.extend({
  /** Plain text extracted from the PDF. */
  text: z.string(),
});
export type ResumeDetail = z.infer<typeof resumeDetailSchema>;
