# ApplyTracker

A full-stack job application tracker: organise applications on a Kanban board, import jobs from a link, get follow-up reminders, and see analytics on your job search.

> 🚧 In active development. See [PLAN.md](PLAN.md) for the roadmap.

## Features

- **Kanban board** — drag applications between stages (mouse, touch or keyboard), with optimistic updates
- **List view** — search, filter by status / work mode / priority / tag, sort, paginate; every view is a shareable URL
- **Application pages** — activity timeline, notes, interviews with outcomes, recruiter contacts, job description
- **Import from a link** — paste a LinkedIn, Indeed, Greenhouse or company job link (or share it from your phone) and the details are filled in for you to review; pages that need sign-in can be pasted as text (optional AI)
- **Dashboard** — reply, interview and offer rates (vs the previous period), funnel, applications per week against a weekly goal and streak, which sources get replies
- **Reminders & notifications** — reminders by email and in-app, follow-up suggestions for quiet applications, interview heads-ups, a weekly summary email
- **Calendar** — agenda of interviews and reminders, `.ics` export and a private subscription link for Google Calendar / Outlook / Apple Calendar
- **Tags, priority and archiving**
- **CSV import / export**
- **Resumes** — upload PDF resumes; their text is extracted for AI matching (stored in S3 or, with no bucket configured, in Postgres)
- **Accounts** — email + password or Google, email verification, password reset, profile and account deletion

## Tech stack

| Area     | Tools                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query  |
| Backend  | NestJS 12, Prisma 7, PostgreSQL 17, Redis 8, Pino, Swagger/OpenAPI, Claude API (optional) |
| Shared   | Zod schemas and types shared by the frontend and backend (`packages/shared`)              |
| Testing  | Vitest, Testing Library, Supertest (e2e against a real database)                          |
| Tooling  | pnpm workspaces, Turborepo, Docker Compose, GitHub Actions, Husky, Commitlint             |

## Architecture

```
apps/
  web/        Next.js frontend            → http://localhost:3000
  api/        NestJS REST API             → http://localhost:4000/api  (docs: /api/docs)
packages/
  shared/             Zod schemas + types used by web and api
  typescript-config/  Shared tsconfig
docker-compose.yml    Postgres, Redis, Mailpit for local development
```

The browser only talks to the web app: Next.js proxies `/api/*` to the NestJS API, so auth cookies are first-party and no cross-origin requests are needed.

API conventions:

- All routes live under `/api`, versioned by URI (`/api/v1/...`). Infrastructure routes such as `/api/health` are version-neutral.
- Every route requires authentication unless explicitly marked `@Public()`.
- Request bodies are validated with the same Zod schemas the web forms use (`packages/shared`), and the Swagger docs are generated from them.
- Every error uses one JSON shape: `{ statusCode, error, message, issues?, path, timestamp, requestId }`, where `issues` lists field-level validation errors.
- Each request gets an `x-request-id` (or reuses the incoming one), which appears in logs and error responses.
- Environment variables are validated with Zod at startup; the app refuses to boot with invalid config.

## Authentication

| Concern             | Approach                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Passwords           | argon2id (OWASP parameters); constant-time behaviour for unknown emails                                  |
| Access token        | 15-minute JWT in an `httpOnly`, `SameSite=Lax` cookie scoped to `/api`                                   |
| Refresh token       | Opaque random token, stored as a SHA-256 hash, `SameSite=Strict` cookie scoped to `/api/v1/auth`         |
| Rotation & reuse    | Every refresh issues a new token; replaying a used one revokes the whole session (token theft detection) |
| Sessions            | One row per signed-in device, 30-day absolute lifetime; password change/reset signs out other devices    |
| Email flows         | Single-use, hashed, expiring tokens for email verification (24 h) and password reset (1 h)               |
| Google sign-in      | OAuth 2.0 Authorization Code + PKCE, `state` checked against a cookie; links verified emails             |
| Abuse protection    | Rate limiting (stricter on login/register/reset), CSRF origin check, Helmet security headers             |
| Account enumeration | Login and forgot-password responses don't reveal whether an email is registered                          |

**Google sign-in (optional):** create an OAuth client in the [Google Cloud console](https://console.cloud.google.com/apis/credentials), add `http://localhost:3000/api/v1/auth/google/callback` as an authorised redirect URI, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `apps/api/.env`. The button appears automatically.

## Job import from links

`POST /api/v1/job-imports/preview-link` turns a job link into a draft the user reviews before saving:

1. **Normalise** the link (tracking parameters removed, LinkedIn/Indeed job ids canonicalised) and check for an already-saved duplicate.
2. **Fetch safely** — only public IP addresses (validated at DNS resolution, so DNS rebinding can't reach internal services), every redirect re-checked, ports 80/443, 10 s and 3 MB limits, HTML only.
3. **Extract**, most reliable first: schema.org `JobPosting` JSON-LD → site parsers (LinkedIn, Indeed, Greenhouse) → meta tags → optionally Claude (structured output) to fill gaps.
4. When a site requires sign-in or blocks automated reads (common for LinkedIn, Indeed, Facebook groups), the user can paste the job text instead (`preview-text`, needs `ANTHROPIC_API_KEY`).

Installed as an app on a phone, ApplyTracker registers a **share target**, so "Share → ApplyTracker" from the LinkedIn or Facebook app opens the import directly.

## Background jobs

Reminders, emails and scheduled scans run on **BullMQ** (Redis):

| Job                     | When                                  | What                                                              |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `reminder-due`          | Delayed until the reminder's due time | In-app notification + email                                       |
| `sweep-due-reminders`   | Every 5 minutes                       | Re-queues due reminders whose job was lost (e.g. Redis restart)   |
| `upcoming-interviews`   | Hourly                                | Heads-up for interviews in the next 24 h                          |
| `follow-up-suggestions` | Every 6 hours                         | Suggests following up on applications with no activity for N days |
| `weekly-summaries`      | Hourly                                | Sends each user's summary on Monday 08:00 in their time zone      |
| `send` (email queue)    | On demand                             | Delivers email, retried with exponential backoff                  |

Every job is idempotent: reminders are claimed atomically in the database and notifications carry a per-user unique dedupe key, so retries and overlapping runs never notify twice.

Workers run inside the API process by default. In production, set `RUN_WORKERS=false` on the API and run `pnpm --filter @apply-tracker/api start:worker` (`node dist/worker.js`) as a separate, independently scalable process.

## File storage

Uploaded resumes go through `StorageService`, which has three interchangeable drivers:

| Driver     | Where files live                                                      | Use it for                                           |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| `s3`       | Any S3-compatible bucket: AWS S3, Cloudflare R2, Backblaze B2, MinIO… | Production, when you have a bucket                   |
| `database` | A `stored_files` table in Postgres                                    | **Default fallback.** Free hosting, local dev, demos |
| `local`    | A folder on disk (`STORAGE_LOCAL_DIR`)                                | Dev, or a server with a persistent volume            |

With `STORAGE_DRIVER` unset, the API uses `s3` when `S3_BUCKET` is set and `database` otherwise, so the app runs without any cloud account. Each resume records the driver that stored it, so changing drivers later keeps old files readable as long as their storage still exists. Files in a driver that is no longer configured return `503`, but their extracted text still works. Resumes are capped at 5 MB and 10 per user, which keeps the Postgres fallback small enough for free database tiers.

## Getting started

**Prerequisites:** Node.js 24 (`nvm use`), pnpm 10, Docker.

```bash
# 1. Install dependencies (also generates the Prisma client)
pnpm install

# 2. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Start Postgres, Redis and Mailpit
pnpm db:up

# 4. Apply database migrations
pnpm --filter @apply-tracker/api db:migrate

# 5. (Optional) Load demo data — sign in as demo@applytracker.dev / demo-pass-123
pnpm --filter @apply-tracker/api db:seed

# 6. Run everything in watch mode
pnpm dev
```

| Service             | URL                              |
| ------------------- | -------------------------------- |
| Web app             | http://localhost:3000            |
| API                 | http://localhost:4000/api        |
| API docs            | http://localhost:4000/api/docs   |
| Health check        | http://localhost:4000/api/health |
| Mailpit (dev email) | http://localhost:8025            |

> Local Redis is exposed on port **6380** to avoid clashing with other Redis instances.

## Scripts

Run from the repository root:

| Command                       | What it does                                                   |
| ----------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                    | Run all apps in watch mode                                     |
| `pnpm build`                  | Build all packages and apps                                    |
| `pnpm lint`                   | Lint (oxlint for the API, ESLint for the web app)              |
| `pnpm typecheck`              | Type-check everything                                          |
| `pnpm test`                   | Unit tests                                                     |
| `pnpm test:e2e`               | API end-to-end tests against the `apply_tracker_test` database |
| `pnpm format`                 | Format with Prettier                                           |
| `pnpm db:up` / `pnpm db:down` | Start / stop local Docker services                             |

Database (run with `pnpm --filter @apply-tracker/api <script>`): `db:migrate`, `db:deploy`, `db:seed`, `db:studio`, `db:reset`.

> Tests run one Vitest worker per CPU core. On a machine that's low on memory, limit them, e.g. `pnpm --filter @apply-tracker/web test -- --maxWorkers=2`.

## Contributing workflow

- Branch from `main`, open a pull request; CI runs format check, lint, typecheck, unit + e2e tests and build.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:` …), enforced by a commit hook.
- Staged files are formatted automatically on commit.
