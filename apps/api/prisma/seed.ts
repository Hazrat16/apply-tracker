/**
 * Seeds a demo account with realistic (fictional) job-search data.
 * Run with `pnpm --filter @apply-tracker/api db:seed`. Re-running replaces the demo data.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { DEMO_APPLICATION_COUNT, DEMO_NAME, seedDemoData } from '../src/demo/demo-data.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { DatabaseStorageDriver } from '../src/storage/drivers/database.driver.js';

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@applytracker.dev';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-pass-123';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  // The seed uses the database storage driver, which needs no configuration.
  const storage = new DatabaseStorageDriver(prisma as unknown as PrismaService);
  const previous = await prisma.resume.findMany({
    where: { user: { email: DEMO_EMAIL } },
    select: { storageKey: true },
  });
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  for (const { storageKey } of previous) await storage.delete(storageKey);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash: await hash(DEMO_PASSWORD),
      emailVerifiedAt: new Date(),
      // A shorter follow-up window so the demo shows suggestions straight away.
      followUpAfterDays: 5,
    },
  });
  await seedDemoData(prisma, user.id, {
    storeFile: async (key, data, contentType) => {
      await storage.put(key, data, contentType);
      return storage.name;
    },
  });

  console.log(
    `Seeded ${DEMO_APPLICATION_COUNT} applications for ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`,
  );
}

await main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
