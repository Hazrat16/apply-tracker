import type { CoverLetterOptions, JobPosting } from '../writers/ai-writer.js';
import { analyseMatch } from './matcher.js';

const HEADINGS = /^(curriculum vitae|r[eé]sum[eé]|cv|profile|contact( details)?)$/i;

/** First resume line, if it looks like a person's name. */
export function guessName(resume: string): string | null {
  const first = resume
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return null;
  const name = first
    .split(/\s+[—–|-]\s+|,/)[0]!
    // "Jane Doe CV", "Jane Doe's Resume" → "Jane Doe"
    .replace(/(?:'s)?\s+(?:cv|r[eé]sum[eé]|curriculum vitae)$/i, '')
    .trim();
  if (HEADINGS.test(name)) return null;
  if (!/^[\p{Lu}][\p{L}'.-]*(?:\s+[\p{Lu}][\p{L}'.-]*){1,3}$/u.test(name) || name.length > 40) {
    return null;
  }
  // "JANE DOE" → "Jane Doe"
  return name === name.toUpperCase()
    ? name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase())
    : name;
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Template cover letter for when no AI model is configured: fills in the role, company and
 * the skills the resume shares with the posting. A starting point to personalise.
 */
export function templateCoverLetter(
  resume: string,
  job: JobPosting,
  options: CoverLetterOptions,
): string {
  const analysis = analyseMatch(resume, job.description);
  const strengths = analysis.matched.slice(0, 3).map((hit) => hit.name);
  const gap = analysis.missing[0]?.name;
  const { roleTitle: role, companyName: company } = job;
  const name = guessName(resume);

  const opening = {
    PROFESSIONAL: `I am writing to apply for the ${role} position at ${company}. Having read the job description, I believe my experience is a close fit for what your team needs.`,
    FRIENDLY: `I'd love to be considered for the ${role} role at ${company}. Reading the job description, it sounded like a team where I could both contribute and keep growing.`,
    ENTHUSIASTIC: `I was really excited to see the ${role} opening at ${company} — it's exactly the kind of role I've been looking for, and I'd love to bring my experience to your team.`,
  }[options.tone];

  const experience = strengths.length
    ? `My background lines up well with what you're looking for. I have hands-on experience with ${list(strengths)}, and I've used ${strengths.length === 1 ? 'it' : 'these'} to deliver real results in my recent work. I'm confident I could put that experience to work for ${company} from early on.`
    : `My background has prepared me well for this role, and I'm confident I could contribute to ${company} from early on.`;

  const growth = gap
    ? ` I'm also keen to keep deepening my experience with ${gap}, which I know matters for this role.`
    : '';

  const closing = {
    PROFESSIONAL: `I would welcome the opportunity to discuss how I can contribute to ${company}. Thank you for your time and consideration.`,
    FRIENDLY: `I'd be glad to chat about how I could help ${company}. Thanks so much for taking the time to read my application.`,
    ENTHUSIASTIC: `I'd love the chance to talk about how I can help ${company} succeed. Thank you for your time — I hope to hear from you soon!`,
  }[options.tone];

  const signOff = options.tone === 'PROFESSIONAL' ? 'Kind regards,' : 'Best regards,';

  return [
    'Dear Hiring Manager,',
    opening,
    experience + growth,
    options.instructions?.trim(),
    closing,
    name ? `${signOff}\n${name}` : signOff,
  ]
    .filter(Boolean)
    .join('\n\n');
}
