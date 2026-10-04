import { analyseMatch } from './matcher.js';

const POSTING = `Senior Backend Engineer
We build APIs with Node.js and TypeScript on PostgreSQL. You will design REST APIs,
run services on AWS with Docker and Kubernetes, and mentor other engineers.
Requirements: 5+ years of experience, strong TypeScript, PostgreSQL, Kubernetes.`;

const RESUME = `Jane Doe
Backend engineer. Built NodeJS services in TypeScript backed by Postgres, deployed with Docker.`;

describe('analyseMatch', () => {
  it('scores skills found in both, weighting skills the posting repeats', () => {
    const result = analyseMatch(RESUME, POSTING);
    expect(result.matchedSkills).toEqual(['PostgreSQL', 'TypeScript', 'Docker', 'Node.js']);
    expect(result.missingSkills).toEqual(['Kubernetes', 'AWS', 'Mentoring', 'REST APIs']);
    // matched weights 2+2+1+1 = 6 of 2+2+1+1+2+1+1+1 = 11
    expect(result.score).toBe(55);
    expect(result.summary).toMatch(/4 of the 8 .* partial match.*Kubernetes, AWS and Mentoring/);
  });

  it('suggests concrete resume edits', () => {
    const { suggestions } = analyseMatch(RESUME, POSTING);
    expect(suggestions).toContain(
      'If you have experience with Kubernetes, AWS and Mentoring, add it with a concrete example — the posting asks for them.',
    );
    expect(suggestions.some((s) => s.includes('stresses PostgreSQL'))).toBe(true);
    expect(suggestions).toContain(
      'Use the posting\'s wording "PostgreSQL" (your resume says "Postgres") so applicant tracking systems recognise it.',
    );
    expect(suggestions.some((s) => s.includes('5+ years'))).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('matches whole words only', () => {
    const result = analyseMatch(
      'Expert in JavaScript',
      'We use Java, Java and C++ daily, plus C#.',
    );
    expect(result.matchedSkills).toEqual([]);
    expect(result.missingSkills).toEqual(['Java', 'C#', 'C++']);
    expect(analyseMatch('C++ and C# developer', 'Java, C++ and C#').matchedSkills).toEqual([
      'C#',
      'C++',
    ]);
  });

  it('ignores everyday words that look like skills', () => {
    const result = analyseMatch('', 'You excel at the rest of the work and express ideas well.');
    expect(result.matchedSkills.concat(result.missingSkills)).not.toEqual(
      expect.arrayContaining(['Excel', 'REST APIs', 'Express']),
    );
  });

  it('falls back to frequent keywords for postings outside the skills list', () => {
    const posting =
      'Nurse wanted. Patient care, patient safety and ward rounds. Medication rounds daily. Ward experience.';
    const result = analyseMatch('Registered nurse with patient care on a surgical ward.', posting);
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['patient', 'ward']));
    expect(result.missingSkills).toEqual(['rounds']);
    expect(result.score).toBe(67);
  });

  it('explains when it found nothing to compare', () => {
    const result = analyseMatch('anything', 'Short posting.');
    expect(result.score).toBe(0);
    expect(result.summary).toMatch(/doesn't name skills/);
  });
});
