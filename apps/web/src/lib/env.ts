import { z } from 'zod';

// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced explicitly.
export const env = z
  .object({
    // Relative by default: requests go through the Next.js `/api` rewrite.
    NEXT_PUBLIC_API_URL: z.string().default('/api'),
    // Optional browser error reporting (Sentry free plan or self-hosted GlitchTip).
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  })
  .parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  });
