import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve the path aliases declared in tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Suites share one test database, so they must not run concurrently.
    fileParallelism: false,
    // Runtime env overrides apps/api/.env, so e2e tests never touch the dev database.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_ENABLED: 'false',
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      WEB_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://apply:apply@localhost:5432/apply_tracker_test?schema=public',
    },
  },
});
