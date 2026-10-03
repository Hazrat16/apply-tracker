import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ email: z.email(), age: z.coerce.number() }));

  it('returns the parsed value', () => {
    expect(pipe.transform({ email: 'a@b.co', age: '30' })).toEqual({ email: 'a@b.co', age: 30 });
  });

  it('throws a 400 listing each invalid field', () => {
    try {
      pipe.transform({ email: 'nope' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        issues: { path: string }[];
      };
      expect(body.issues.map((i) => i.path)).toEqual(['email', 'age']);
    }
  });
});
