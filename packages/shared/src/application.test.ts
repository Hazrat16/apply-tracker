import { describe, expect, it } from 'vitest';
import { applicationStatusSchema } from './application.js';

describe('applicationStatusSchema', () => {
  it('accepts a known status', () => {
    expect(applicationStatusSchema.parse('INTERVIEW')).toBe('INTERVIEW');
  });

  it('rejects an unknown status', () => {
    expect(applicationStatusSchema.safeParse('HIRED').success).toBe(false);
  });
});
