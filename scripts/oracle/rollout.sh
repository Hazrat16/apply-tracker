#!/usr/bin/env bash
# Pull the images CI pushed to GHCR and start them on the free VM.
set -euo pipefail

: "${ORACLE_HOST:?}"
: "${ORACLE_SSH_KEY:?}"
: "${IMAGE_REGISTRY:?}"
: "${IMAGE_TAG:?}"
: "${ACME_EMAIL:?}"
: "${GHCR_USER:?}"
: "${GHCR_TOKEN:?}"

root="$(cd "$(dirname "$0")/../.." && pwd)"
key="$(mktemp)"
payload="$(mktemp)"
trap 'rm -f "$key" "$payload"' EXIT
printf '%s\n' "$ORACLE_SSH_KEY" > "$key"
chmod 600 "$key"

{
  printf 'export IMAGE_REGISTRY=%q\n' "$IMAGE_REGISTRY"
  printf 'export IMAGE_TAG=%q\n' "$IMAGE_TAG"
  printf 'export ACME_EMAIL=%q\n' "$ACME_EMAIL"
  printf 'export PUBLIC_IP=%q\n' "$ORACLE_HOST"
  printf 'export GHCR_USER=%q\n' "$GHCR_USER"
  printf 'export GHCR_TOKEN=%q\n' "$GHCR_TOKEN"
  printf 'export COMPOSE_B64=%q\n' "$(base64 -w0 "$root/deploy/docker-compose.yml")"
  printf 'export CADDY_B64=%q\n' "$(base64 -w0 "$root/deploy/Caddyfile")"
  cat "$root/scripts/deploy/remote.sh"
} > "$payload"

user="${ORACLE_USER:-ubuntu}"
if [ -z "$user" ]; then
  user=ubuntu
fi
ssh -i "$key" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
  "${user}@${ORACLE_HOST}" bash -s < "$payload"
