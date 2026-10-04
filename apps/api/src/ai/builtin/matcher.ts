import type { MatchResult } from '../writers/ai-writer.js';
import { SKILLS } from './skills.js';

/** Below this many recognised skills in a posting, the matcher falls back to keywords. */
const MIN_SKILLS = 3;
const MAX_KEYWORDS = 25;

export interface SkillHit {
  /** Display name, e.g. "Node.js". */
  name: string;
  /** Mentions in the job posting. */
  mentions: number;
  /** Wording used in the posting / resume (null if absent from the resume). */
  postingTerm: string;
  resumeTerm: string | null;
  resumeMentions: number;
}

export interface MatchAnalysis extends MatchResult {
  matched: SkillHit[];
  missing: SkillHit[];
}

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Word boundaries that also treat "+", "#" and "." as part of a term (C++, C#, .NET, Node.js).
const termPattern = (term: string) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}_+#.])${escape(term)}(?![\\p{L}\\p{N}_+#]|\\.[\\p{L}\\p{N}])`,
    'giu',
  );

const patterns = SKILLS.map(([name, ...aliases]) => ({
  name: name!,
  aliases: aliases.map((alias) => ({ alias, pattern: termPattern(alias) })),
}));

/** Count of mentions and the most-used spelling of a skill in a text. */
function find(text: string, skill: (typeof patterns)[number]) {
  let mentions = 0;
  let term: string | null = null;
  let best = 0;
  for (const { pattern } of skill.aliases) {
    const found = text.match(pattern);
    const count = found?.length ?? 0;
    mentions += count;
    if (count > best) {
      best = count;
      // As written in the text, e.g. "PostgreSQL" rather than the alias "postgresql".
      term = found![0]!;
    }
  }
  return { mentions, term };
}

/**
 * Keyword-based resume ↔ job comparison, for when no AI model is configured. It recognises
 * skills from a curated list (falling back to frequent words), weights skills the posting
 * repeats, and suggests resume edits from the gaps.
 */
export function analyseMatch(resume: string, posting: string): MatchAnalysis {
  const hits: SkillHit[] = [];
  for (const skill of patterns) {
    const inPosting = find(posting, skill);
    if (inPosting.mentions === 0) continue;
    const inResume = find(resume, skill);
    hits.push({
      name: skill.name,
      mentions: inPosting.mentions,
      postingTerm: inPosting.term!,
      resumeTerm: inResume.term,
      resumeMentions: inResume.mentions,
    });
  }

  const items = hits.length >= MIN_SKILLS ? hits : [...hits, ...keywordHits(resume, posting, hits)];
  items.sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
  const matched = items.filter((hit) => hit.resumeMentions > 0);
  const missing = items.filter((hit) => hit.resumeMentions === 0);

  // Skills the posting repeats count double.
  const weight = (hit: SkillHit) => (hit.mentions >= 2 ? 2 : 1);
  const total = items.reduce((sum, hit) => sum + weight(hit), 0);
  const score =
    total === 0 ? 0 : Math.round((100 * matched.reduce((s, h) => s + weight(h), 0)) / total);

  return {
    score,
    summary: summarise(score, matched, missing, items.length),
    matchedSkills: matched.slice(0, 12).map((hit) => hit.name),
    missingSkills: missing.slice(0, 12).map((hit) => hit.name),
    suggestions: suggest(resume, posting, matched, missing),
    matched,
    missing,
  };
}

const STOPWORDS = new Set(
  `about above after again against also among an and any are around as at be because been before being below between both but by can could did do does doing down during each either etc every few for from further get had has have having he her here hers him his how however if in into is it its itself just least less like made make many may me more most much must my no nor not now of off on once only or other our ours out over own per please plus same she should so some such than that the their theirs them then there these they this those through to too under until up upon us very via was we well were what when where which while who whom why will with within without would you your yours
  ability able across apply applicant applicants benefits candidate candidates company day days etc environment experience experienced including join looking new offer opportunity position preferred required requirements responsibilities role skills strong team teams work working year years job jobs knowledge level plus related relevant using use used good great excellent best based within across ensure help building build develop development developing support supporting world`.split(
    /\s+/,
  ),
);

/** Frequent meaningful words in the posting, for postings outside the skills list. */
function keywordHits(resume: string, posting: string, known: SkillHit[]): SkillHit[] {
  const counts = new Map<string, number>();
  for (const word of posting.toLowerCase().match(/\p{L}[\p{L}\p{N}+#-]{2,}/gu) ?? []) {
    if (!STOPWORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const taken = new Set(known.map((hit) => hit.postingTerm.toLowerCase()));
  return [...counts]
    .filter(([word, count]) => count >= 2 && !taken.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS - known.length)
    .map(([word, mentions]) => {
      const resumeMentions = resume.match(termPattern(word))?.length ?? 0;
      return {
        name: word,
        mentions,
        postingTerm: word,
        resumeTerm: resumeMentions ? word : null,
        resumeMentions,
      };
    });
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

function summarise(score: number, matched: SkillHit[], missing: SkillHit[], total: number) {
  if (total === 0) {
    return "The job description doesn't name skills this matcher recognises, so it can't compare them. Read the posting and check your resume covers what it asks for.";
  }
  const fit =
    score >= 75 ? 'a strong match' : score >= 50 ? 'a partial match' : 'a weak match so far';
  const shown = `Your resume mentions ${matched.length} of the ${total} skills and keywords this posting asks for — ${fit}.`;
  const gaps = missing.slice(0, 3).map((hit) => hit.name);
  return gaps.length
    ? `${shown} The biggest gaps are ${list(gaps)}.`
    : `${shown} Every requirement it found appears in your resume.`;
}

function suggest(resume: string, posting: string, matched: SkillHit[], missing: SkillHit[]) {
  const suggestions: string[] = [];

  const gaps = missing.slice(0, 3).map((hit) => hit.name);
  if (gaps.length) {
    suggestions.push(
      `If you have experience with ${list(gaps)}, add it with a concrete example — the posting asks for ${gaps.length === 1 ? 'it' : 'them'}.`,
    );
  }

  const understated = matched.find((hit) => hit.mentions >= 2 && hit.resumeMentions === 1);
  if (understated) {
    suggestions.push(
      `The posting stresses ${understated.name}; make it more prominent, e.g. in your summary or most recent role.`,
    );
  }

  const differentWording = matched.find(
    (hit) => hit.resumeTerm && hit.resumeTerm.toLowerCase() !== hit.postingTerm.toLowerCase(),
  );
  if (differentWording) {
    suggestions.push(
      `Use the posting's wording "${differentWording.postingTerm}" (your resume says "${differentWording.resumeTerm}") so applicant tracking systems recognise it.`,
    );
  }

  const years = /(\d{1,2})\s*\+?\s*(?:or more\s+)?years/i.exec(posting);
  if (years) {
    suggestions.push(
      `The posting asks for ${years[1]}+ years of experience — make your dates and total years easy to spot.`,
    );
  }

  const words = resume.split(/\s+/).filter(Boolean).length;
  if (words < 200) {
    suggestions.push(
      'Your resume is short — add outcomes and numbers for your recent roles (what changed because of your work).',
    );
  } else if (words > 1200) {
    suggestions.push(
      'Your resume is long — trim older or unrelated roles so the relevant ones stand out.',
    );
  }

  return suggestions.slice(0, 5);
}
