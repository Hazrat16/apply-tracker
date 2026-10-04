import { PermanentAiError } from './ai-writer.js';
import { OpenAiCompatibleWriter } from './openai-compatible.writer.js';

const job = { roleTitle: 'Engineer', companyName: 'Acme', description: 'TypeScript' };

function writerReturning(response: Response, apiKey?: string) {
  const fetchFn = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(response),
  );
  const writer = new OpenAiCompatibleWriter(
    { baseUrl: 'http://localhost:11434/v1/', model: 'llama3.2', apiKey },
    fetchFn as unknown as typeof fetch,
  );
  return { writer, fetchFn };
}

const completion = (content: string) =>
  Response.json({ choices: [{ message: { role: 'assistant', content } }] });

describe('OpenAiCompatibleWriter', () => {
  it('requests JSON and parses a match, tolerating fences and loose types', async () => {
    const { writer, fetchFn } = writerReturning(
      completion('```json\n{"score": "72", "summary": "Good", "matchedSkills": ["TS"]}\n```'),
      'secret',
    );
    expect(await writer.matchResume('resume', job)).toEqual({
      score: 72,
      summary: 'Good',
      matchedSkills: ['TS'],
      missingSkills: [],
      suggestions: [],
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' });
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ model: 'llama3.2', response_format: { type: 'json_object' } });
    expect(body.messages[1].content).toContain('<resume>\nresume\n</resume>');
  });

  it('sends no Authorization header without a key and returns letter text', async () => {
    const { writer, fetchFn } = writerReturning(completion('  Dear Hiring Manager, …  '));
    expect(
      await writer.writeCoverLetter('resume', job, { tone: 'FRIENDLY', instructions: 'Berlin' }),
    ).toBe('Dear Hiring Manager, …');
    const init = fetchFn.mock.calls[0]![1]!;
    expect(init.headers).not.toHaveProperty('Authorization');
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty('response_format');
    expect(body.messages[1].content).toContain('<candidate_notes>\nBerlin');
  });

  it('retries invalid JSON and server errors, but not client errors', async () => {
    await expect(
      writerReturning(completion('not json')).writer.matchResume('r', job),
    ).rejects.not.toBeInstanceOf(PermanentAiError);
    await expect(
      writerReturning(new Response('busy', { status: 503 })).writer.matchResume('r', job),
    ).rejects.not.toBeInstanceOf(PermanentAiError);
    await expect(
      writerReturning(new Response('model "x" not found', { status: 404 })).writer.matchResume(
        'r',
        job,
      ),
    ).rejects.toBeInstanceOf(PermanentAiError);
  });
});
