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

export const STORAGE_DRIVERS = ['s3', 'database', 'local'] as const;
export const AI_PROVIDERS = ['builtin', 'openai-compatible', 'anthropic'] as const;

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

  /**
   * Engine for resume matching and cover letters. Defaults to `anthropic` when
   * ANTHROPIC_API_KEY is set, otherwise `builtin` — a keyword matcher and letter template
   * that need no AI service and cost nothing.
   */
  AI_PROVIDER: z.enum(AI_PROVIDERS).optional(),
  /** OpenAI-compatible endpoint, e.g. Ollama: http://localhost:11434/v1 */
  AI_BASE_URL: z.url().optional(),
  /** API key for the OpenAI-compatible endpoint, if it needs one (Ollama doesn't). */
  AI_API_KEY: z.string().optional(),
  /** Model name; required for `openai-compatible`, defaults to claude-opus-5-5 for `anthropic`. */
  AI_MODEL: z.string().optional(),

  // Google sign-in is enabled only when both are set.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /**
   * Where uploaded files (resumes) are kept. Defaults to `s3` when S3_BUCKET is set, otherwise
   * `database` (Postgres), which needs no extra service and survives ephemeral host disks.
   */
  STORAGE_DRIVER: z.enum(STORAGE_DRIVERS).optional(),
  /** Folder for the `local` driver — only safe on a host with a persistent disk. */
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  // Any S3-compatible service: AWS S3, Cloudflare R2, Backblaze B2, MinIO, Supabase Storage…
  S3_BUCKET: z.string().optional(),
  /** `auto` for Cloudflare R2. */
  S3_REGION: z.string().default('us-east-1'),
  /** Leave empty for AWS; required for other providers, e.g. https://<account>.r2.cloudflarestorage.com */
  S3_ENDPOINT: z.url().optional(),
  /** Leave both empty to use the AWS default credential chain (IAM role, ~/.aws…). */
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Path-style URLs (bucket in the path) — needed by MinIO and most self-hosted servers. */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema>;
export type StorageDriverName = (typeof STORAGE_DRIVERS)[number];
export type AiProviderName = (typeof AI_PROVIDERS)[number];

/** The storage driver new files are written to. */
export function resolveStorageDriver(
  env: Pick<Env, 'STORAGE_DRIVER' | 'S3_BUCKET'>,
): StorageDriverName {
  return env.STORAGE_DRIVER ?? (env.S3_BUCKET ? 's3' : 'database');
}

/** The engine used for resume matching and cover letters. */
export function resolveAiProvider(
  env: Pick<Env, 'AI_PROVIDER' | 'ANTHROPIC_API_KEY'>,
): AiProviderName {
  return env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? 'anthropic' : 'builtin');
}

/** Used by ConfigModule — fails fast at startup with a readable error if the env is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  // Treat empty strings (e.g. `GOOGLE_CLIENT_ID=`) as unset.
  const cleaned = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) {
    throw new Error('Invalid environment variables:\nSTORAGE_DRIVER=s3 requires S3_BUCKET');
  }
  if (!env.S3_ACCESS_KEY_ID !== !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      'Invalid environment variables:\nSet both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither',
    );
  }
  if (env.AI_PROVIDER === 'openai-compatible' && (!env.AI_BASE_URL || !env.AI_MODEL)) {
    throw new Error(
      'Invalid environment variables:\nAI_PROVIDER=openai-compatible requires AI_BASE_URL and AI_MODEL',
    );
  }
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Invalid environment variables:\nAI_PROVIDER=anthropic requires ANTHROPIC_API_KEY',
    );
  }
  return env;
}
