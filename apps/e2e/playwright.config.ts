import { defineConfig, devices } from '@playwright/test';

// Browser tests run the production builds (`pnpm build` first) on their own ports, against
// the test database, so they never touch the dev servers or dev data.
const API_PORT = 4100;
const WEB_PORT = 3100;
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://apply:apply@localhost:5432/apply_tracker_test?schema=public';
const REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6380/2';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/mobile\.spec\.ts/, /screenshots/],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec\.ts/,
    },
    // `pnpm screenshots`: regenerates the README images.
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, testMatch: /screenshots\.ts/ },
  ],
  webServer: [
    {
      command: 'pnpm exec prisma migrate deploy && node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        DATABASE_URL,
        REDIS_URL,
        QUEUE_PREFIX: 'apply-tracker-e2e',
        // Background jobs (e.g. resume matching) run in the API process.
        RUN_WORKERS: 'true',
        RATE_LIMIT_ENABLED: 'false',
        WEB_URL: `http://localhost:${WEB_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        JWT_ACCESS_SECRET: 'e2e-secret-that-is-at-least-32-characters-long',
        DEMO_ENABLED: 'true',
        STORAGE_DRIVER: 'database',
        AI_PROVIDER: 'builtin',
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        SENTRY_DSN: '',
      },
    },
    {
      command: `pnpm exec next start --port ${WEB_PORT}`,
      cwd: '../web',
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
