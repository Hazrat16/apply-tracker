import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

/** Applies all migrations to the test database before the e2e suite runs. */
export default function setup(project: TestProject): void {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: project.config.env.DATABASE_URL },
  });
}
