import type { StorageDriverName } from '../config/env.js';
import type {
  ApplicationSource,
  ApplicationStatus,
  InterviewType,
  Priority,
  PrismaClient,
  WorkMode,
} from '../generated/prisma/client.js';
import { canonicalJobUrl } from '../job-import/job-url.js';
import { extractPdfText } from '../resumes/pdf-text.js';
import { makePdf } from '../resumes/simple-pdf.js';

// Realistic (fictional) job-search data for the `db:seed` demo account and for the
// throwaway accounts behind "Try the demo".

export const DEMO_NAME = 'Alex Morgan';

const NORTHWIND_JD = `Northwind Labs builds the payments infrastructure behind 3,000 online shops.

As a Senior Backend Engineer you will design and run the services that move money: APIs in TypeScript and Node.js (NestJS), PostgreSQL, Redis and Kafka, deployed on AWS with Docker and Kubernetes.

What you'll do
- Design reliable, idempotent REST APIs and event-driven services
- Own services end to end: design, testing, CI/CD, monitoring and on-call
- Mentor engineers and lead technical design reviews

What we're looking for
- 5+ years of backend experience with TypeScript or Node.js
- Strong PostgreSQL and system design skills
- Experience with Kubernetes and AWS
- Clear communication with product and stakeholders`;

const MASSIVE_DYNAMIC_JD = `Massive Dynamic is hiring a Staff Engineer to set the technical direction for our data platform.

You will lead the architecture of distributed systems that process billions of events a day, using Go and Python on Google Cloud, with Kafka, Spark and BigQuery.

Requirements
- 8+ years of experience, including technical leadership of several teams
- Distributed systems and system design at scale
- Go or Python in production; experience with Spark and Airflow
- Mentoring and stakeholder management`;

const DEMO_RESUME = [
  `Alex Morgan
Senior Software Engineer - Berlin - alex.morgan@example.com

SUMMARY
Backend engineer with 7 years of experience building APIs and payment systems in
TypeScript and Node.js. I like reliable systems, clean APIs and helping teams grow.

EXPERIENCE
Senior Backend Engineer, Fintech GmbH (2021 - present)
- Built NestJS services on PostgreSQL that process 2 million payments a day
- Introduced Kafka event streaming, cutting settlement delays from hours to minutes
- Mentored 4 engineers and ran our system design reviews

Software Engineer, Shopwise (2018 - 2021)
- Built REST APIs in Node.js and TypeScript for a marketplace with 500k users
- Moved deployments to Docker and GitHub Actions CI/CD (deploys went from weekly to daily)`,
  `SKILLS
TypeScript, JavaScript, Node.js, NestJS, Express.js, PostgreSQL, Redis, Kafka, Docker,
AWS, REST APIs, GraphQL, CI/CD, Unit testing, Agile, Mentoring

EDUCATION
BSc Computer Science, TU Munich (2018)`,
];

export const DEMO_TAGS = [
  { name: 'backend', color: 'blue' },
  { name: 'frontend', color: 'purple' },
  { name: 'dream job', color: 'pink' },
  { name: 'referral', color: 'green' },
  { name: 'visa sponsor', color: 'amber' },
];

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const dateOnly = (date: Date) => new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);

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
  /** Job description, so the match and cover letter features have something to work with. */
  description?: string;
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
    description: NORTHWIND_JD,
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
    description: MASSIVE_DYNAMIC_JD,
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

export interface DemoDataOptions {
  /** Stores the demo resume PDF; without it no resume is added. */
  storeFile?: (key: string, data: Uint8Array, contentType: string) => Promise<StorageDriverName>;
}

/** Fills an (empty) account with sample applications, reminders, tags and a resume. */
export async function seedDemoData(
  prisma: PrismaClient,
  userId: string,
  options: DemoDataOptions = {},
): Promise<void> {
  const tags = await prisma.tag.createManyAndReturn({
    data: DEMO_TAGS.map((tag) => ({ ...tag, userId })),
  });
  const tagId = (name: string) => tags.find((tag) => tag.name === name)!.id;

  const ids = new Map<string, string>();
  for (const [index, seed] of APPLICATIONS.entries()) {
    const path = PATHS[seed.status];
    const created = daysAgo(seed.daysAgo);
    const step = Math.max(1, Math.floor(seed.daysAgo / path.length));
    const jobUrl = `https://careers.example.com/${seed.company.toLowerCase().replace(/\s+/g, '-')}/${index + 1}`;

    // The last status change is the last activity, so quiet applications look quiet
    // (and get follow-up suggestions).
    const lastChange = new Date(created.getTime() + (path.length - 1) * step * DAY);

    const application = await prisma.application.create({
      data: {
        user: { connect: { id: userId } },
        company: {
          connectOrCreate: {
            where: {
              userId_normalizedName: {
                userId: userId,
                normalizedName: seed.company.toLowerCase(),
              },
            },
            create: {
              userId: userId,
              name: seed.company,
              normalizedName: seed.company.toLowerCase(),
            },
          },
        },
        roleTitle: seed.role,
        jobDescription: seed.description,
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
        jobUrl,
        canonicalJobUrl: canonicalJobUrl(jobUrl),
        createdAt: created,
        updatedAt: lastChange,
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
    ids.set(seed.company, application.id);
  }

  const tomorrowNine = new Date(Date.now() + DAY);
  tomorrowNine.setUTCHours(9, 0, 0, 0);
  await prisma.reminder.createMany({
    data: [
      {
        userId: userId,
        applicationId: ids.get('Stark Mobility'),
        title: 'Reply to the Stark Mobility offer',
        note: 'Ask about the signing bonus before accepting.',
        dueAt: new Date(Date.now() - DAY),
      },
      {
        userId: userId,
        applicationId: ids.get('Contoso Cloud'),
        title: 'Prepare questions for the Contoso phone screen',
        dueAt: tomorrowNine,
      },
      {
        userId: userId,
        title: 'Update CV with the payments project',
        dueAt: new Date(Date.now() + 3 * DAY),
      },
    ],
  });

  if (options.storeFile) {
    const pdf = makePdf(DEMO_RESUME);
    const key = `resumes/${userId}/demo-resume.pdf`;
    const { text, pages } = await extractPdfText(pdf);
    const driver = await options.storeFile(key, pdf, 'application/pdf');
    await prisma.resume.create({
      data: {
        userId,
        label: 'Backend resume',
        fileName: 'Alex Morgan - Resume.pdf',
        contentType: 'application/pdf',
        sizeBytes: pdf.byteLength,
        storageDriver: driver,
        storageKey: key,
        text,
        pageCount: pages,
      },
    });
  }
}

export const DEMO_APPLICATION_COUNT = APPLICATIONS.length;
