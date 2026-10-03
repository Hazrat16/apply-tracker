import { z } from 'zod';

const csv = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Public URL of the web app — used for email links and OAuth redirects. */
  WEB_URL: z.url().default('http://localhost:3000'),
  /** Browser origins allowed to call the API (CORS + CSRF origin check). */
  CORS_ORIGINS: csv('http://localhost:3000'),
  /** Express `trust proxy` setting, so req.ip is the real client IP behind proxies. */
  TRUST_PROXY: z.string().default('loopback'),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://localhost:6380'),
  /** Run background workers (reminders, emails, scheduled jobs) in this process. */
  RUN_WORKERS: z.stringbool().default(true),
  /** Redis key prefix for queues, so several environments can share one Redis. */
  QUEUE_PREFIX: z.string().default('apply-tracker'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('ApplyTracker <no-reply@applytracker.local>'),

  RATE_LIMIT_ENABLED: z.stringbool().default(true),

  // Optional: AI extraction for job imports (pasted text, pages without structured data).
  ANTHROPIC_API_KEY: z.string().optional(),
  JOB_IMPORT_AI_MODEL: z.string().default('claude-opus-5-5'),

  // Google sign-in is enabled only when both are set.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule — fails fast at startup with a readable error if the env is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  // Treat empty strings (e.g. `GOOGLE_CLIENT_ID=`) as unset.
  const cleaned = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
