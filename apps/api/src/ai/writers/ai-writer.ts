import type { CoverLetterTone } from '@apply-tracker/shared';
import { z } from 'zod';
import type { AiProviderName } from '../../config/env.js';

/** Injection token for the configured AiWriter. */
export const AI_WRITER = Symbol('AI_WRITER');

/** A failure retrying won't fix (refusal, bad request, wrong key or model). */
export class PermanentAiError extends Error {}

export interface JobPosting {
  roleTitle: string;
  companyName: string;
  description: string;
}

export const matchResultSchema = z.object({
  score: z.number(),
  summary: z.string(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type MatchResult = z.infer<typeof matchResultSchema>;

export interface CoverLetterOptions {
  tone: CoverLetterTone;
  instructions?: string | null;
}

/**
 * Produces resume matches and cover letters. Implementations: `builtin` (no AI, free),
 * `openai-compatible` (Ollama, Groq, Gemini, OpenRouter, LM Studio…) and `anthropic`.
 * Throw PermanentAiError for failures that retrying won't fix; any other error is retried.
 */
export interface AiWriter {
  readonly provider: AiProviderName;
  /** Model name shown to the user; null for the built-in engine. */
  readonly model: string | null;
  matchResume(resume: string, job: JobPosting): Promise<MatchResult>;
  writeCoverLetter(resume: string, job: JobPosting, options: CoverLetterOptions): Promise<string>;
}
