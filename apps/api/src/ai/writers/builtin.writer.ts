import { templateCoverLetter } from '../builtin/cover-letter.js';
import { analyseMatch } from '../builtin/matcher.js';
import type { AiWriter, CoverLetterOptions, JobPosting, MatchResult } from './ai-writer.js';

/** Free, offline engine: keyword matching and a cover letter template — no AI service. */
export class BuiltinWriter implements AiWriter {
  readonly provider = 'builtin';
  readonly model = null;

  matchResume(resume: string, job: JobPosting): Promise<MatchResult> {
    const {
      matched: _matched,
      missing: _missing,
      ...result
    } = analyseMatch(resume, job.description);
    return Promise.resolve(result);
  }

  writeCoverLetter(resume: string, job: JobPosting, options: CoverLetterOptions): Promise<string> {
    return Promise.resolve(templateCoverLetter(resume, job, options));
  }
}
