/**
 * Seeds a demo account with realistic (fictional) job-search data.
 * Run with `pnpm --filter @apply-tracker/api db:seed`. Re-running replaces the demo data.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import {
  type ApplicationSource,
  type ApplicationStatus,
  type InterviewType,
  PrismaClient,
  type Priority,
  type WorkMode,
} from '../src/generated/prisma/client.js';

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@applytracker.dev';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-pass-123';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const dateOnly = (date: Date) => new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);

const TAGS = [
  { name: 'backend', color: 'blue' },
  { name: 'frontend', color: 'purple' },
  { name: 'dream job', color: 'pink' },
  { name: 'referral', color: 'green' },
  { name: 'visa sponsor', color: 'amber' },
];

/** Status path each application took, so the history (and later analytics) looks real. */
const PATHS: Record<ApplicationStatus, ApplicationStatus[]> = {
  WISHLIST: ['WISHLIST'],
  APPLIED: ['WISHLIST', 'APPLIED'],
  ASSESSMENT: ['APPLIED', 'ASSESSMENT'],
  INTERVIEW: ['APPLIED', 'ASSESSMENT', 'INTERVIEW'],
  OFFER: ['APPLIED', 'INTERVIEW', 'OFFER'],
  ACCEPTED: ['APPLIED', 'INTERVIEW', 'OFFER', 'ACCEPTED'],
  REJECTED: ['APPLIED', 'INTERVIEW', 'REJECTED'],
  WITHDRAWN: ['APPLIED', 'WITHDRAWN'],
  GHOSTED: ['APPLIED', 'GHOSTED'],
};

interface Seed {
  company: string;
  role: string;
  status: ApplicationStatus;
  daysAgo: number;
  location: string;
  workMode: WorkMode;
  source: ApplicationSource;
  priority: Priority;
  salary?: [number, number, string];
  tags?: string[];
  interview?: { type: InterviewType; inDays: number };
  note?: string;
  contact?: { name: string; role: string };
}

const APPLICATIONS: Seed[] = [
  {
    company: 'Northwind Labs',
    role: 'Senior Backend Engineer',
    status: 'INTERVIEW',
    daysAgo: 18,
    location: 'Berlin',
    workMode: 'HYBRID',
    source: 'LINKEDIN',
    priority: 'HIGH',
    salary: [75000, 90000, 'EUR'],
    tags: ['backend', 'dream job'],
    interview: { type: 'TECHNICAL', inDays: 3 },
    note: 'System design round next — review event sourcing and idempotency.',
    contact: { name: 'Mara Lindqvist', role: 'Engineering Manager' },
  },
  {
    company: 'Contoso Cloud',
    role: 'Full-Stack Developer',
    status: 'INTERVIEW',
    daysAgo: 12,
    location: 'Remote (EU)',
    workMode: 'REMOTE',
    source: 'COMPANY_WEBSITE',
    priority: 'HIGH',
    salary: [70000, 85000, 'EUR'],
    tags: ['frontend', 'backend'],
    interview: { type: 'PHONE_SCREEN', inDays: 1 },
    contact: { name: 'Dev Patel', role: 'Technical Recruiter' },
  },
  {
    company: 'Globex',
    role: 'Platform Engineer',
    status: 'ASSESSMENT',
    daysAgo: 9,
    location: 'Amsterdam',
    workMode: 'HYBRID',
    source: 'REFERRAL',
    priority: 'MEDIUM',
    tags: ['backend', 'referral', 'visa sponsor'],
    note: 'Take-home due Friday: build a rate limiter service.',
  },
  {
    company: 'Initech',
    role: 'Software Engineer II',
    status: 'APPLIED',
    daysAgo: 6,
    location: 'London',
    workMode: 'ONSITE',
    source: 'INDEED',
    priority: 'MEDIUM',
    salary: [60000, 72000, 'GBP'],
    tags: ['backend'],
  },
  {
    company: 'Hooli',
    role: 'Frontend Engineer',
    status: 'APPLIED',
    daysAgo: 4,
    location: 'Remote',
    workMode: 'REMOTE',
    source: 'LINKEDIN',
    priority: 'LOW',
    tags: ['frontend'],
  },
  {
    company: 'Pied Piper',
    role: 'Backend Engineer (Go)',
    status: 'APPLIED',
    daysAgo: 3,
    location: 'Lisbon',
    workMode: 'HYBRID',
    source: 'JOB_BOARD',
    priority: 'MEDIUM',
    salary: [55000, 68000, 'EUR'],
    tags: ['backend', 'visa sponsor'],
  },
  {
    company: 'Umbrella Health',
    role: 'Full-Stack Engineer',
    status: 'APPLIED',
    daysAgo: 2,
    location: 'Dublin',
    workMode: 'HYBRID',
    source: 'RECRUITER',
    priority: 'MEDIUM',
    contact: { name: 'Aoife Byrne', role: 'Talent Partner' },
  },
  {
    company: 'Stark Mobility',
    role: 'Software Engineer, Payments',
    status: 'OFFER',
    daysAgo: 30,
    location: 'Munich',
    workMode: 'HYBRID',
    source: 'REFERRAL',
    priority: 'HIGH',
    salary: [80000, 95000, 'EUR'],
    tags: ['backend', 'referral'],
    note: 'Offer received — deadline to respond in one week. Negotiate signing bonus.',
  },
  {
    company: 'Wayne Analytics',
    role: 'Data Platform Engineer',
    status: 'REJECTED',
    daysAgo: 35,
    location: 'Remote',
    workMode: 'REMOTE',
    source: 'LINKEDIN',
    priority: 'MEDIUM',
    note: 'Feedback: strong coding, wanted more Spark experience.',
  },
  {
    company: 'Cyberdyne Systems',
    role: 'Backend Developer',
    status: 'REJECTED',
    daysAgo: 28,
    location: 'Zurich',
    workMode: 'ONSITE',
    source: 'COMPANY_WEBSITE',
    priority: 'LOW',
  },
  {
    company: 'Soylent Foods',
    role: 'Junior Full-Stack Developer',
    status: 'GHOSTED',
    daysAgo: 40,
    location: 'Remote',
    workMode: 'REMOTE',
    source: 'JOB_BOARD',
    priority: 'LOW',
  },
  {
    company: 'Tyrell Robotics',
    role: 'API Engineer',
    status: 'WITHDRAWN',
    daysAgo: 25,
    location: 'Stockholm',
    workMode: 'ONSITE',
    source: 'RECRUITER',
    priority: 'LOW',
    note: 'Withdrew — role required relocation within 2 weeks.',
  },
  {
    company: 'Massive Dynamic',
    role: 'Staff Engineer',
    status: 'WISHLIST',
    daysAgo: 1,
    location: 'Remote',
    workMode: 'REMOTE',
    source: 'LINKEDIN',
    priority: 'HIGH',
    tags: ['dream job'],
  },
  {
    company: 'Aperture Science',
    role: 'Frontend Engineer (React)',
    status: 'WISHLIST',
    daysAgo: 1,
    location: 'Copenhagen',
    workMode: 'HYBRID',
    source: 'COMPANY_WEBSITE',
    priority: 'MEDIUM',
    tags: ['frontend', 'visa sponsor'],
  },
  {
    company: 'Oscorp',
    role: 'Node.js Developer',
    status: 'WISHLIST',
    daysAgo: 0,
    location: 'Warsaw',
    workMode: 'HYBRID',
    source: 'FACEBOOK',
    priority: 'LOW',
    tags: ['backend'],
  },
];

async function main() {
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      passwordHash: await hash(DEMO_PASSWORD),
      emailVerifiedAt: new Date(),
      tags: { create: TAGS },
    },
    include: { tags: true },
  });
  const tagId = (name: string) => user.tags.find((tag) => tag.name === name)!.id;

  for (const [index, seed] of APPLICATIONS.entries()) {
    const path = PATHS[seed.status];
    const created = daysAgo(seed.daysAgo);
    const step = Math.max(1, Math.floor(seed.daysAgo / path.length));

    await prisma.application.create({
      data: {
        user: { connect: { id: user.id } },
        company: {
          connectOrCreate: {
            where: {
              userId_normalizedName: {
                userId: user.id,
                normalizedName: seed.company.toLowerCase(),
              },
            },
            create: {
              userId: user.id,
              name: seed.company,
              normalizedName: seed.company.toLowerCase(),
            },
          },
        },
        roleTitle: seed.role,
        status: seed.status,
        position: index * 1024,
        location: seed.location,
        workMode: seed.workMode,
        source: seed.source,
        priority: seed.priority,
        salaryMin: seed.salary?.[0],
        salaryMax: seed.salary?.[1],
        currency: seed.salary?.[2] ?? 'USD',
        appliedAt: seed.status === 'WISHLIST' ? null : dateOnly(created),
        jobUrl: `https://careers.example.com/${seed.company.toLowerCase().replace(/\s+/g, '-')}/${index + 1}`,
        createdAt: created,
        tags: { connect: (seed.tags ?? []).map((name) => ({ id: tagId(name) })) },
        statusHistory: {
          create: path.map((toStatus, i) => ({
            fromStatus: i === 0 ? null : path[i - 1],
            toStatus,
            changedAt: new Date(created.getTime() + i * step * DAY),
          })),
        },
        notes: seed.note ? { create: { body: seed.note } } : undefined,
        contacts: seed.contact ? { create: seed.contact } : undefined,
        interviews: seed.interview
          ? {
              create: {
                type: seed.interview.type,
                scheduledAt: new Date(Date.now() + seed.interview.inDays * DAY),
                durationMinutes: 60,
                location: 'Video call',
              },
            }
          : undefined,
      },
    });
  }

  console.log(
    `Seeded ${APPLICATIONS.length} applications for ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`,
  );
}

await main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
