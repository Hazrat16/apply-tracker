# ApplyTracker — Project Plan

A full-stack job application tracker: manage every application on a Kanban board, get follow-up reminders, match your resume against job descriptions, and see analytics on your job search.

---

## 1. Goals

- **Product:** a tool real job seekers (starting with me) use daily.
- **CV:** demonstrate production-grade full-stack skills — separate API + frontend, auth, background jobs, testing, CI/CD, Docker, cloud deployment, monitoring.

---

## 2. Tech Stack

| Layer              | Choice                                                                                             | Why it matters on a CV                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Monorepo           | **pnpm workspaces + Turborepo**                                                                    | Shared code, real-world repo structure                                 |
| Frontend           | **Next.js 16 (App Router, React 19) + TypeScript + Tailwind 4 + shadcn/ui**                        | Most in-demand React framework                                         |
| Data fetching      | **TanStack Query**                                                                                 | Caching, optimistic updates                                            |
| Forms / validation | **React Hook Form + Zod** (schemas shared with the API)                                            | End-to-end type safety                                                 |
| Backend            | **NestJS 12 + TypeScript** (REST, ESM, Node 24 LTS)                                                | Layered architecture, dependency injection, modules — enterprise style |
| Database           | **PostgreSQL 17 + Prisma 7 ORM**                                                                   | Relational modelling, migrations                                       |
| Cache / queue      | **Redis + BullMQ**                                                                                 | Background jobs (reminders, emails, AI tasks)                          |
| Auth               | **JWT access + refresh tokens (httpOnly cookies), Google OAuth, bcrypt**                           | Secure auth done properly                                              |
| File storage       | **S3-compatible (AWS S3 / Cloudflare R2)**; local S3 emulator chosen in Phase 5                    | Resume PDF uploads                                                     |
| Email              | **Resend** (or Nodemailer + SMTP)                                                                  | Verification, password reset, reminders                                |
| AI                 | **Claude API**                                                                                     | Resume ↔ job description matching, cover letter drafts                 |
| API docs           | **Swagger / OpenAPI** (auto-generated)                                                             | Professional API                                                       |
| Testing            | **Vitest** (API unit + e2e with Supertest, web with Testing Library), **Playwright** (browser E2E) | Shows quality mindset                                                  |
| Code quality       | oxlint (API), ESLint (web), Prettier, Husky + lint-staged, Conventional Commits                    | Team-ready workflow                                                    |
| DevOps             | **Docker + docker-compose**, **GitHub Actions** CI/CD                                              | Reproducible environments                                              |
| Deploy             | Vercel (web), Render/Railway/Fly.io (API + worker), Neon (Postgres), Upstash (Redis)               | Live demo link for CV                                                  |
| Monitoring         | **Sentry** (errors), **Pino** structured logs, `/health` endpoint                                  | Production readiness                                                   |

---

## 3. Architecture

```
                ┌──────────────────────┐
  Browser ────▶ │  Next.js (apps/web)  │
                └──────────┬───────────┘
                           │ REST (JSON, cookies)
                ┌──────────▼───────────┐       ┌────────────┐
                │  NestJS API (apps/api)│──────▶│ PostgreSQL │
                └──────┬────────┬──────┘       └────────────┘
                       │        │ enqueue
                       │   ┌────▼─────┐   ┌──────────────────┐
                       │   │  Redis   │◀──│ Worker (BullMQ)  │── Email / Claude API
                       │   └──────────┘   └──────────────────┘
                       ▼
                 S3 / R2 (resume files)
```

### Repository layout

```
apply-tracker/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend (+ worker entrypoint)
├── packages/
│   ├── shared/           # Zod schemas, types, enums shared by web + api
│   └── tsconfig/
├── docker-compose.yml    # postgres, redis, mailpit
├── .github/workflows/    # CI pipelines
├── turbo.json
└── README.md
```

---

## 4. Data Model (first version)

- **User** — id, email, passwordHash, name, avatarUrl, emailVerified, provider, createdAt
- **RefreshToken / Session** — id, userId, tokenHash, expiresAt, userAgent
- **Company** — id, userId, name, website, location, notes
- **Application** — id, userId, companyId, roleTitle, jobUrl, jobDescription, status, position (for board order), salaryMin, salaryMax, currency, location, workMode (remote/hybrid/onsite), source (LinkedIn, referral…), priority, appliedAt, resumeId
- **StatusHistory** — id, applicationId, fromStatus, toStatus, changedAt _(powers analytics)_
- **Contact** — id, userId, companyId, name, email, linkedinUrl, role, notes
- **Interview** — id, applicationId, round, type (phone/technical/HR/onsite), scheduledAt, notes, outcome
- **Reminder** — id, applicationId, dueAt, message, sentAt
- **Resume** — id, userId, label, fileKey, parsedText, createdAt
- **Tag / ApplicationTag** — free-form labels
- **ActivityLog** — id, userId, action, entityType, entityId, createdAt

Statuses: `WISHLIST → APPLIED → OA/ASSESSMENT → INTERVIEW → OFFER → ACCEPTED | REJECTED | WITHDRAWN | GHOSTED`

---

## 5. Features by Phase

### Phase 0 — Foundation (setup)

- [x] Monorepo with pnpm + Turborepo, shared TS config + Prettier, Node 24 pinned (`.nvmrc`)
- [x] `docker-compose` with Postgres (dev + test DBs), Redis, Mailpit
- [x] NestJS skeleton: Zod-validated env, Prisma 7, Pino logger with request IDs, global error filter, Helmet, CORS, `/api/health`, Swagger at `/api/docs`
- [x] Next.js skeleton with Tailwind + shadcn/ui, TanStack Query, typed API client, dark mode, landing page with live API status
- [x] Tests: API unit + e2e (real test DB), web component/unit tests
- [x] GitHub Actions: format → lint → typecheck → test → e2e → build on every PR
- [x] Husky + lint-staged + commitlint

### Phase 1 — Auth & Users

- [x] Register / login with email + password (argon2id, rate-limited)
- [x] JWT access token + rotating refresh token in httpOnly cookies, with refresh-token reuse detection
- [x] Email verification and password reset (Mailpit in dev)
- [x] Google OAuth login (Authorization Code + PKCE)
- [x] Protected routes on web (Next.js proxy + client auth gate), settings page (profile, password, delete account)
- [x] CSRF origin check, account-enumeration-safe responses, `/api` proxied through Next.js for first-party cookies

### Phase 2 — Core Tracker (MVP)

- [ ] Application CRUD with company auto-create
- [ ] **Kanban board** with drag-and-drop (dnd-kit) and optimistic updates
- [ ] Table/list view with search, filters (status, tag, date, work mode), sorting, pagination
- [ ] Application detail page: notes, contacts, interviews, timeline (status history)
- [ ] Tags, priority, archive
- [ ] CSV import/export

> ✅ **Milestone: MVP deployed with a live demo link.**

### Phase 2.5 — Import Job from a Link (LinkedIn, Facebook, any job site)

Paste or share a job URL → the job lands on the board in **Wishlist** with fields pre-filled.

**User entry points**

- [ ] "Add from link" input on the board (paste URL → preview → confirm)
- [ ] **Mobile share:** the web app is installable as a PWA and registers a **Web Share Target**, so tapping _Share → ApplyTracker_ in the LinkedIn/Facebook app sends the link straight in
- [ ] Browser extension button (Phase 6) for pages that need login

**Backend pipeline** (`POST /api/v1/applications/import` → BullMQ job → status polled or pushed to the UI)

1. Validate and normalise the URL (strip tracking params, resolve `lnkd.in` / `fb.me` short links), detect duplicates by canonical URL
2. Fetch the public page server-side (timeout, size limit, SSRF protection: block private IPs)
3. Extract data in priority order:
   - `JobPosting` **JSON-LD** structured data (used by LinkedIn public job pages and most job boards)
   - Open Graph / meta tags (`og:title`, `og:description`, `og:site_name`)
   - Site-specific parsers (LinkedIn, Indeed, Bdjobs, Glassdoor…) behind a common `JobSourceParser` interface
   - **AI fallback:** send cleaned page text to the Claude API to extract title, company, location, salary, work mode and description into a strict schema
4. Save as an Application with `sourceUrl`, `source` (LINKEDIN / FACEBOOK / OTHER) and `importStatus`
5. If the page is blocked or needs login: create the card with just the link and ask the user to **paste the job text**, which then goes through the same AI extraction

**Known limitations**

- LinkedIn and Facebook block or limit automated access, and many posts (especially Facebook group posts) are only visible when logged in. The server never logs in or scrapes with user credentials. For those pages, use the browser extension, which reads the page the user already has open, or paste the text.
- Respect each site's terms: fetch only the one page the user shared, on demand, and never crawl.

**Data model additions:** `Application.sourceUrl`, `Application.canonicalUrl` (unique per user), `Application.importStatus` (PENDING / SUCCESS / PARTIAL / FAILED), `Application.rawImport` (JSON)

### Phase 3 — Reminders & Automation

- [ ] Follow-up reminders (BullMQ delayed jobs) → email + in-app notifications
- [ ] Auto-suggest follow-up when an application has had no update for N days
- [ ] Interview calendar view + `.ics` export
- [ ] Weekly email summary

### Phase 4 — Analytics Dashboard

- [ ] KPIs: total applied, response rate, interview rate, offer rate
- [ ] Funnel chart (Applied → Interview → Offer)
- [ ] Applications per week, sources that perform best, average time to response
- [ ] Weekly goal + streak tracking

### Phase 5 — AI Features (the "wow" factor)

- [ ] Resume upload (PDF → S3), text extraction
- [ ] **Resume ↔ JD match score**: matched/missing skills, suggestions (Claude API, run as a background job)
- [ ] Cover letter draft generator
- [ ] Parse a pasted job posting → auto-fill application fields

### Phase 6 — Polish & Production

- [ ] Browser extension (Chrome) to save a job from LinkedIn/Indeed in one click
- [ ] Accessibility pass (keyboard navigation for the board), responsive mobile layout
- [ ] Sentry; move rate-limit storage to Redis so limits hold across API instances
- [ ] Deployment: make sure the hosting edge sets `X-Forwarded-For` and configure `TRUST_PROXY`, otherwise every user shares one IP for rate limiting (the Next.js `/api` rewrite forwards the header but does not add it)
- [ ] Active sessions list in settings ("sign out other devices")
- [ ] Seeded **demo account** so recruiters can try it without signing up
- [ ] E2E tests for critical flows (signup → add application → move on board)
- [ ] README with screenshots/GIF, architecture diagram, setup guide; short demo video

---

## 6. Engineering Standards

- **Branching:** `main` protected; feature branches + pull requests (even solo — it shows on GitHub)
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`…)
- **API:** versioned (`/api/v1`), consistent error format, DTO validation, OpenAPI docs at `/api/docs`
- **Security:** no secrets in repo (`.env.example` only), ownership checks on every query (users only see their own data), rate limits on auth routes
- **Testing target:** services unit-tested, controllers integration-tested against a real test DB, key user journeys E2E
- **Tracking:** GitHub Issues + Projects board for each phase

---

## 7. How to Present It on Your CV

> **ApplyTracker** — Full-stack job application tracker | Next.js, NestJS, PostgreSQL, Redis, Docker, AWS S3, Claude API
>
> - Built a Kanban-based tracker with drag-and-drop and optimistic UI, serving a REST API with JWT/OAuth auth and OpenAPI docs.
> - Implemented background job processing (BullMQ/Redis) for scheduled follow-up reminders and AI resume-to-job matching.
> - Built one-click job import from LinkedIn/Facebook/job-board links (JSON-LD parsing + LLM extraction fallback, PWA share target, SSRF-safe fetching).
> - Set up CI/CD with GitHub Actions, Dockerised services, and achieved __% test coverage with Vitest and Playwright.
> - Live demo: `<link>` · Code: `<github link>`

---

## 8. Next Step

Start **Phase 2**: the core tracker — application CRUD, Kanban board with drag-and-drop, list view with filters.
