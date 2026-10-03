import { describe, expect, it } from 'vitest';
import { emailSchema, passwordSchema, registerSchema } from './auth.js';

describe('emailSchema', () => {
  it('normalises case and whitespace', () => {
    expect(emailSchema.parse('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
  });

  it('rejects invalid addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it.each([
    ['short1', 'at least 8'],
    ['onlyletters', 'number'],
    ['12345678', 'letter'],
  ])('rejects %s', (password, message) => {
    const result = passwordSchema.safeParse(password);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(message);
  });

  it('accepts a password with letters and numbers', () => {
    expect(passwordSchema.safeParse('hunter2hunter2').success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('trims the name', () => {
    const parsed = registerSchema.parse({
      name: '  Jane  ',
      email: 'jane@example.com',
      password: 'secret123',
    });
    expect(parsed.name).toBe('Jane');
  });
});
