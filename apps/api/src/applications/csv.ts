import {
  type ApplicationSummary,
  type CreateApplicationData,
  createApplicationSchema,
} from '@apply-tracker/shared';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export const MAX_IMPORT_ROWS = 1000;

type Cell = string | number | null;

const EXPORT_COLUMNS: [header: string, value: (app: ApplicationSummary) => Cell][] = [
  ['Company', (a) => a.company.name],
  ['Role', (a) => a.roleTitle],
  ['Status', (a) => a.status],
  ['Priority', (a) => a.priority],
  ['Location', (a) => a.location],
  ['Work mode', (a) => a.workMode],
  ['Source', (a) => a.source],
  ['Salary min', (a) => a.salaryMin],
  ['Salary max', (a) => a.salaryMax],
  ['Currency', (a) => a.currency],
  ['Applied on', (a) => a.appliedAt],
  ['Job URL', (a) => a.jobUrl],
  ['Tags', (a) => a.tags.map((tag) => tag.name).join('; ')],
  ['Archived', (a) => (a.archivedAt ? 'yes' : '')],
  ['Created at', (a) => a.createdAt],
];

/** Neutralises spreadsheet formula injection (a cell starting with `=`, `+`, `-`, `@`). */
const safeCell = (value: Cell): string => {
  const text = value == null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

export function applicationsToCsv(applications: ApplicationSummary[]): string {
  return stringify(
    applications.map((app) => EXPORT_COLUMNS.map(([, value]) => safeCell(value(app)))),
    { header: true, columns: EXPORT_COLUMNS.map(([header]) => header), bom: true },
  );
}

/** Accepted header names (lower-cased, spaces/underscores ignored) for each field. */
const HEADER_ALIASES: Record<string, string[]> = {
  companyName: ['company', 'companyname', 'employer', 'organisation', 'organization'],
  roleTitle: ['role', 'roletitle', 'title', 'jobtitle', 'position'],
  status: ['status', 'stage'],
  priority: ['priority'],
  location: ['location', 'city'],
  workMode: ['workmode', 'remote', 'worktype'],
  source: ['source'],
  salaryMin: ['salarymin', 'minsalary'],
  salaryMax: ['salarymax', 'maxsalary'],
  currency: ['currency'],
  appliedAt: ['appliedon', 'appliedat', 'dateapplied', 'applieddate'],
  jobUrl: ['joburl', 'url', 'link', 'joblink'],
  tags: ['tags', 'labels'],
};

const normaliseHeader = (header: string) => header.toLowerCase().replace(/[\s_-]/g, '');
const enumValue = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

export interface ParsedRow {
  /** 1-based line in the file (the header is line 1). */
  row: number;
  data?: CreateApplicationData & { tagNames: string[] };
  error?: string;
}

export function parseApplicationsCsv(input: Buffer | string): ParsedRow[] {
  const records = parse(input, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length > MAX_IMPORT_ROWS) {
    throw new Error(`A file can contain at most ${MAX_IMPORT_ROWS} applications`);
  }

  return records.map((record, index) => {
    const row = index + 2;
    const fields: Record<string, string> = {};
    for (const [header, value] of Object.entries(record)) {
      const key = Object.entries(HEADER_ALIASES).find(([, aliases]) =>
        aliases.includes(normaliseHeader(header)),
      )?.[0];
      if (key && value !== '') fields[key] = value;
    }

    const toNumber = (value?: string) =>
      value === undefined ? undefined : Number(value.replace(/[,\s]/g, ''));

    const result = createApplicationSchema.safeParse({
      companyName: fields.companyName ?? '',
      roleTitle: fields.roleTitle ?? '',
      status: fields.status && enumValue(fields.status),
      priority: fields.priority && enumValue(fields.priority),
      location: fields.location,
      workMode: fields.workMode && enumValue(fields.workMode),
      source: fields.source && enumValue(fields.source),
      salaryMin: toNumber(fields.salaryMin),
      salaryMax: toNumber(fields.salaryMax),
      currency: fields.currency,
      appliedAt: fields.appliedAt,
      jobUrl: fields.jobUrl,
    });

    if (!result.success) {
      const issue = result.error.issues[0]!;
      const field = issue.path.join('.');
      return { row, error: field ? `${field}: ${issue.message}` : issue.message };
    }

    const tagNames = (fields.tags ?? '')
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
    return { row, data: { ...result.data, tagNames } };
  });
}
