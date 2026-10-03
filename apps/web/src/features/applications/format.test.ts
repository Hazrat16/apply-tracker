import { formatPlace, formatSalary } from './format';

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

describe('formatPlace', () => {
  it('joins location and work mode', () => {
    expect(formatPlace('Berlin', 'HYBRID')).toBe('Berlin · Hybrid');
  });

  it('does not repeat the work mode', () => {
    expect(formatPlace('Remote (EU)', 'REMOTE')).toBe('Remote (EU)');
  });

  it('handles missing parts', () => {
    expect(formatPlace(null, 'ONSITE')).toBe('On-site');
    expect(formatPlace(null, null)).toBe('');
  });
});
