import { z } from 'zod';

/** Shortest job description the AI features accept — less gives meaningless results. */
export const AI_MIN_JOB_DESCRIPTION = 100;

export const AI_TASK_STATUSES = ['PENDING', 'RUNNING', 'DONE', 'FAILED'] as const;
export const aiTaskStatusSchema = z.enum(AI_TASK_STATUSES);
export type AiTaskStatus = z.infer<typeof aiTaskStatusSchema>;

export const AI_PROVIDERS = ['builtin', 'openai-compatible', 'anthropic'] as const;

export const aiStatusSchema = z.object({
  /** `builtin` = free keyword matcher and letter template, no AI model involved. */
  provider: z.enum(AI_PROVIDERS),
  model: z.string().nullable(),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;

export const createResumeMatchSchema = z.object({ resumeId: z.uuid('Choose a resume') });
export type CreateResumeMatchInput = z.infer<typeof createResumeMatchSchema>;

/** How well a resume fits an application's job description. */
export const resumeMatchSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  resumeId: z.string(),
  resumeLabel: z.string(),
  status: aiTaskStatusSchema,
  /** 0–100, null until done. */
  score: z.number().int().nullable(),
  summary: z.string().nullable(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  suggestions: z.array(z.string()),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type ResumeMatch = z.infer<typeof resumeMatchSchema>;

export const COVER_LETTER_TONES = ['PROFESSIONAL', 'FRIENDLY', 'ENTHUSIASTIC'] as const;
export const coverLetterToneSchema = z.enum(COVER_LETTER_TONES);
export type CoverLetterTone = z.infer<typeof coverLetterToneSchema>;

export const createCoverLetterSchema = z.object({
  resumeId: z.uuid('Choose a resume'),
  tone: coverLetterToneSchema.default('PROFESSIONAL'),
  /** Anything else to mention, e.g. "relocating to Berlin in March". */
  instructions: z
    .string()
    .trim()
    .max(1000, 'Keep instructions under 1000 characters')
    .optional()
    .transform((value) => value || undefined),
});
export type CreateCoverLetterInput = z.input<typeof createCoverLetterSchema>;
export type CreateCoverLetterData = z.output<typeof createCoverLetterSchema>;

export const updateCoverLetterSchema = z.object({
  content: z.string().trim().min(1, 'The letter is empty').max(20_000),
});
export type UpdateCoverLetterInput = z.infer<typeof updateCoverLetterSchema>;

export const coverLetterSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  /** Null if the resume it was written from has since been deleted. */
  resumeId: z.string().nullable(),
  resumeLabel: z.string().nullable(),
  tone: coverLetterToneSchema,
  status: aiTaskStatusSchema,
  content: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CoverLetter = z.infer<typeof coverLetterSchema>;
