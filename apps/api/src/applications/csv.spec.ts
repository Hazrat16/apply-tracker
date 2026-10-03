import type { ApplicationSummary } from '@apply-tracker/shared';
import { applicationsToCsv, parseApplicationsCsv } from './csv.js';

const app: ApplicationSummary = {
  id: '1',
  roleTitle: 'Engineer, Platform',
  status: 'APPLIED',
  position: 0,
  company: { id: 'c', name: '=HYPERLINK("evil")' },
  jobUrl: 'https://acme.example/jobs/1',
  location: 'Berlin',
  workMode: 'HYBRID',
  source: 'LINKEDIN',
  priority: 'HIGH',
  salaryMin: 60000,
  salaryMax: 80000,
  currency: 'EUR',
  appliedAt: '2026-09-01',
  archivedAt: null,
  tags: [
    { id: 't1', name: 'backend', color: 'blue' },
    { id: 't2', name: 'dream job', color: 'pink' },
  ],
  nextInterviewAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

describe('applicationsToCsv', () => {
  it('writes a header and quotes values containing commas', () => {
    const lines = applicationsToCsv([app]).replace(/^﻿/, '').trim().split('\n');
    expect(lines[0]).toMatch(/^Company,Role,Status/);
    expect(lines[1]).toContain('"Engineer, Platform"');
    expect(lines[1]).toContain('backend; dream job');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(applicationsToCsv([app])).toContain(`"'=HYPERLINK(""evil"")"`);
  });
});

describe('parseApplicationsCsv', () => {
  it('round-trips an export', () => {
    const [row] = parseApplicationsCsv(
      applicationsToCsv([{ ...app, company: { id: 'c', name: 'Acme' } }]),
    );
    expect(row?.data).toMatchObject({
      companyName: 'Acme',
      roleTitle: 'Engineer, Platform',
      status: 'APPLIED',
      workMode: 'HYBRID',
      salaryMin: 60000,
      currency: 'EUR',
      appliedAt: '2026-09-01',
      tagNames: ['backend', 'dream job'],
    });
  });

  it('accepts friendly headers and values', () => {
    const csv =
      'Job Title,Employer,Stage,Work Mode,Date Applied\nDesigner,Globex,phone screen,remote,2026-08-15\n';
    const [row] = parseApplicationsCsv(csv);
    // "phone screen" is not a status, so the row is reported rather than guessed.
    expect(row).toEqual({ row: 2, error: expect.stringContaining('status') });

    const [ok] = parseApplicationsCsv(csv.replace('phone screen', 'interview'));
    expect(ok?.data).toMatchObject({
      companyName: 'Globex',
      roleTitle: 'Designer',
      status: 'INTERVIEW',
      workMode: 'REMOTE',
    });
  });

  it('reports the line number of invalid rows', () => {
    const rows = parseApplicationsCsv('Company,Role\nAcme,Engineer\n,Designer\n');
    expect(rows[0]?.data).toBeDefined();
    expect(rows[1]).toEqual({ row: 3, error: 'companyName: Company is required' });
  });
});
