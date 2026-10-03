import { formatSalary } from './format';

describe('formatSalary', () => {
  it('formats ranges compactly', () => {
    expect(formatSalary(70000, 85000, 'EUR')).toBe('€70K–85K');
  });

  it('formats a single value', () => {
    expect(formatSalary(120000, null, 'USD')).toBe('$120K');
  });

  it('returns null without a salary', () => {
    expect(formatSalary(null, null, 'USD')).toBeNull();
  });
});
