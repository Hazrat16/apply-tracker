import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  type AiWriter,
  type CoverLetterOptions,
  type JobPosting,
  type MatchResult,
  matchResultSchema,
  PermanentAiError,
} from './ai-writer.js';
import { COVER_LETTER_SYSTEM, coverLetterPrompt, MATCH_SYSTEM, postingPrompt } from './prompts.js';

/** Claude API (paid; optional). */
export class AnthropicWriter implements AiWriter {
  readonly provider = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    // The queue retries, so the SDK only retries once per attempt.
    this.client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
  }

  async matchResume(resume: string, job: JobPosting): Promise<MatchResult> {
    const response = await this.call(() =>
      this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16_000,
        // If a safety classifier declines, the API retries on a suitable fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(matchResultSchema) },
        system: MATCH_SYSTEM,
        messages: [{ role: 'user', content: postingPrompt(resume, job) }],
      }),
    );
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new PermanentAiError(`No match result (stop reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
  }

  async writeCoverLetter(
    resume: string,
    job: JobPosting,
    options: CoverLetterOptions,
  ): Promise<string> {
    const response = await this.call(() =>
      this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16_000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: COVER_LETTER_SYSTEM,
        messages: [{ role: 'user', content: coverLetterPrompt(resume, job, options) }],
      }),
    );
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
    if (response.stop_reason === 'refusal' || !text) {
      throw new PermanentAiError(`No cover letter (stop reason: ${response.stop_reason})`);
    }
    return text;
  }

  /** Rate limits, overload and network errors are rethrown for the queue to retry. */
  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      const retryable =
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError ||
        error instanceof Anthropic.APIConnectionError ||
        (error instanceof Anthropic.APIError && error.status === 529);
      if (!retryable && error instanceof Anthropic.APIError) {
        throw new PermanentAiError(`Claude API error ${error.status ?? ''}: ${error.message}`);
      }
      throw error;
    }
  }
}
