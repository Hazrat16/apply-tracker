#!/bin/sh
# Container entrypoint: apply pending migrations, then start the API (or the worker with
# `docker run … worker`). Set RUN_MIGRATIONS=false when another process runs migrations.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node_modules/.bin/prisma migrate deploy
fi

if [ "$1" = "worker" ]; then
  exec node dist/worker.js
fi
exec node dist/main.js
