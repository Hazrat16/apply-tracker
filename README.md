# ApplyTracker

A full-stack job application tracker: organise applications on a Kanban board, import jobs from a link, get follow-up reminders, and see analytics on your job search.

> 🚧 In active development. See [PLAN.md](PLAN.md) for the roadmap.

## Tech stack

| Area     | Tools                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query |
| Backend  | NestJS 12, Prisma 7, PostgreSQL 17, Redis 8, Pino, Swagger/OpenAPI                       |
| Shared   | Zod schemas and types shared by the frontend and backend (`packages/shared`)             |
| Testing  | Vitest, Testing Library, Supertest (e2e against a real database)                         |
| Tooling  | pnpm workspaces, Turborepo, Docker Compose, GitHub Actions, Husky, Commitlint            |

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

API conventions:

- All routes live under `/api`, versioned by URI (`/api/v1/...`). Infrastructure routes such as `/api/health` are version-neutral.
- Every error uses one JSON shape: `{ statusCode, error, message, path, timestamp, requestId }`.
- Each request gets an `x-request-id` (or reuses the incoming one), which appears in logs and error responses.
- Environment variables are validated with Zod at startup; the app refuses to boot with invalid config.

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

# 5. Run everything in watch mode
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

Database (run with `pnpm --filter @apply-tracker/api <script>`): `db:migrate`, `db:deploy`, `db:studio`, `db:reset`.

## Contributing workflow

- Branch from `main`, open a pull request; CI runs format check, lint, typecheck, unit + e2e tests and build.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:` …), enforced by a commit hook.
- Staged files are formatted automatically on commit.
