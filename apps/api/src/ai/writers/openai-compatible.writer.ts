import { z } from 'zod';
import {
  type AiWriter,
  type CoverLetterOptions,
  type JobPosting,
  type MatchResult,
  PermanentAiError,
} from './ai-writer.js';
import {
  COVER_LETTER_SYSTEM,
  coverLetterPrompt,
  MATCH_JSON_INSTRUCTIONS,
  MATCH_SYSTEM,
  postingPrompt,
} from './prompts.js';

export interface OpenAiCompatibleOptions {
  /** e.g. http://localhost:11434/v1 (Ollama) or https://api.groq.com/openai/v1 */
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Local models on modest hardware can take minutes. */
  timeoutMs?: number;
}

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

/** Lenient: small local models often return numbers as strings or omit empty lists. */
const looseMatchSchema = z.object({
  score: z.coerce.number(),
  summary: z.string().default(''),
  matchedSkills: z.array(z.coerce.string()).default([]),
  missingSkills: z.array(z.coerce.string()).default([]),
  suggestions: z.array(z.coerce.string()).default([]),
});

/**
 * Any server speaking the OpenAI Chat Completions API: Ollama or LM Studio (free, local),
 * or hosted free tiers such as Groq, Google Gemini and OpenRouter.
 */
export class OpenAiCompatibleWriter implements AiWriter {
  readonly provider = 'openai-compatible';
  readonly model: string;
  private readonly endpoint: string;

  constructor(
    private readonly options: OpenAiCompatibleOptions,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.model = options.model;
    this.endpoint = `${options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  async matchResume(resume: string, job: JobPosting): Promise<MatchResult> {
    const content = await this.complete({
      system: `${MATCH_SYSTEM}\n\n${MATCH_JSON_INSTRUCTIONS}`,
      user: postingPrompt(resume, job),
      json: true,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(content));
    } catch {
      // Models occasionally wrap or truncate JSON; another attempt usually works.
      throw new Error('The model did not return valid JSON');
    }
    const result = looseMatchSchema.safeParse(parsed);
    if (!result.success) throw new Error('The model returned JSON in an unexpected shape');
    return result.data;
  }

  async writeCoverLetter(
    resume: string,
    job: JobPosting,
    options: CoverLetterOptions,
  ): Promise<string> {
    const text = (
      await this.complete({
        system: COVER_LETTER_SYSTEM,
        user: coverLetterPrompt(resume, job, options),
        json: false,
      })
    ).trim();
    if (!text) throw new Error('The model returned an empty letter');
    return text;
  }

  private async complete(request: { system: string; user: string; json: boolean }) {
    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.apiKey && { Authorization: `Bearer ${this.options.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        ...(request.json && { response_format: { type: 'json_object' } }),
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 300_000),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      const message = `AI server error ${response.status}: ${detail}`;
      // Rate limits and server errors are worth retrying; other 4xx (bad model name,
      // wrong key) are not.
      if (response.status === 429 || response.status >= 500) throw new Error(message);
      throw new PermanentAiError(message);
    }

    const body = completionSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) throw new Error('Unexpected response from the AI server');
    return body.data.choices[0]!.message.content ?? '';
  }
}

function stripFences(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return (fenced?.[1] ?? text).trim();
}
