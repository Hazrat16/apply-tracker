import { guessName, templateCoverLetter } from './cover-letter.js';

const job = {
  roleTitle: 'Backend Engineer',
  companyName: 'Acme',
  description: 'We use TypeScript, PostgreSQL and Kubernetes. TypeScript everywhere.',
};

describe('templateCoverLetter', () => {
  it('fills in the role, company, shared skills and name', () => {
    const letter = templateCoverLetter('Jane Doe\nTypeScript and PostgreSQL developer', job, {
      tone: 'PROFESSIONAL',
    });
    expect(
      letter.startsWith(
        'Dear Hiring Manager,\n\nI am writing to apply for the Backend Engineer position at Acme.',
      ),
    ).toBe(true);
    expect(letter).toContain('hands-on experience with TypeScript and PostgreSQL');
    expect(letter).toContain('deepening my experience with Kubernetes');
    expect(letter.endsWith('Kind regards,\nJane Doe')).toBe(true);
    expect(letter).not.toMatch(/\[|\]|undefined|null/);
  });

  it('uses the tone and includes the candidate notes', () => {
    const letter = templateCoverLetter('TypeScript', job, {
      tone: 'ENTHUSIASTIC',
      instructions: 'I am relocating to Berlin in March.',
    });
    expect(letter).toContain('I was really excited to see the Backend Engineer opening at Acme');
    expect(letter).toContain('\n\nI am relocating to Berlin in March.\n\n');
    expect(letter.endsWith('Best regards,')).toBe(true);
  });
});

describe('guessName', () => {
  it.each([
    ['Jane Doe\nEngineer', 'Jane Doe'],
    ['Jane Doe — Senior Engineer', 'Jane Doe'],
    ['María José García, Berlin', 'María José García'],
    ['CURRICULUM VITAE', null],
    ['Jane Doe CV', 'Jane Doe'],
    ["John Smith's Resume", 'John Smith'],
    ["JANE O'NEIL-DOE\nEngineer", "Jane O'Neil-Doe"],
    ['jane@example.com', null],
    ['Senior engineer with 10 years', null],
  ])('%j → %j', (resume, name) => {
    expect(guessName(resume)).toBe(name);
  });
});
