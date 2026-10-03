import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Fallback lets `prisma generate` run without a database (e.g. on fresh install or in CI).
    url: process.env.DATABASE_URL ?? '',
  },
});
