import { describe, expect, it } from 'vitest';
import {
  applicationListQuerySchema,
  applicationStatusSchema,
  createApplicationSchema,
  updateApplicationSchema,
} from './application.js';

describe('applicationStatusSchema', () => {
  it('accepts a known status', () => {
    expect(applicationStatusSchema.parse('INTERVIEW')).toBe('INTERVIEW');
  });

  it('rejects an unknown status', () => {
    expect(applicationStatusSchema.safeParse('HIRED').success).toBe(false);
  });
});

describe('createApplicationSchema', () => {
  it('applies defaults and trims', () => {
    const data = createApplicationSchema.parse({ companyName: ' Acme ', roleTitle: 'Engineer' });
    expect(data).toMatchObject({
      companyName: 'Acme',
      status: 'WISHLIST',
      priority: 'MEDIUM',
      currency: 'USD',
      tagIds: [],
    });
  });

  it('turns empty optional strings into null', () => {
    const data = createApplicationSchema.parse({
      companyName: 'Acme',
      roleTitle: 'Engineer',
      location: '  ',
      jobUrl: '',
    });
    expect(data.location).toBeNull();
    expect(data.jobUrl).toBeNull();
  });

  it('rejects non-http URLs and an inverted salary range', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Acme',
      roleTitle: 'Engineer',
      jobUrl: 'javascript:alert(1)',
      salaryMin: 100,
      salaryMax: 50,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.')).sort()).toEqual([
      'jobUrl',
      'salaryMax',
    ]);
  });
});

describe('updateApplicationSchema', () => {
  it('does not fill in defaults for omitted fields', () => {
    expect(updateApplicationSchema.parse({ roleTitle: 'Senior Engineer' })).toEqual({
      roleTitle: 'Senior Engineer',
    });
  });
});

describe('applicationListQuerySchema', () => {
  it('parses comma-separated filters and pagination from query strings', () => {
    const query = applicationListQuerySchema.parse({
      status: 'APPLIED,INTERVIEW',
      archived: 'true',
      page: '2',
    });
    expect(query).toMatchObject({
      status: ['APPLIED', 'INTERVIEW'],
      archived: true,
      page: 2,
      pageSize: 20,
      sort: 'updatedAt',
      order: 'desc',
    });
  });

  it('rejects unknown statuses', () => {
    expect(applicationListQuerySchema.safeParse({ status: 'APPLIED,HIRED' }).success).toBe(false);
  });
});
