# syntax=docker/dockerfile:1
# API + worker image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t applytracker-api .
# Run the worker from the same image with:  docker run … applytracker-api worker

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@apply-tracker/api..." run build
# A self-contained copy of the API with production dependencies only.
RUN pnpm --filter @apply-tracker/api deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
ENTRYPOINT ["sh", "./docker-start.sh"]
