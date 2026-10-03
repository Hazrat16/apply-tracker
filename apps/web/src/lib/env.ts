import { z } from 'zod';

// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced explicitly.
export const env = z
  .object({
    NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000/api'),
  })
  .parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });
