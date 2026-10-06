#!/usr/bin/env bash
# Copy the stack to the instance with Systems Manager and start it. Images are already in ECR.
set -euo pipefail

: "${AWS_REGION:?}"
: "${AWS_INSTANCE_ID:?}"
: "${IMAGE_REGISTRY:?}"
: "${IMAGE_TAG:?}"
: "${ACME_EMAIL:?}"

root="$(cd "$(dirname "$0")/../.." && pwd)"
payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

{
  printf 'export AWS_REGION=%q\n' "$AWS_REGION"
  printf 'export IMAGE_REGISTRY=%q\n' "$IMAGE_REGISTRY"
  printf 'export IMAGE_TAG=%q\n' "$IMAGE_TAG"
  printf 'export ACME_EMAIL=%q\n' "$ACME_EMAIL"
  printf 'export COMPOSE_B64=%q\n' "$(base64 -w0 "$root/deploy/docker-compose.yml")"
  printf 'export CADDY_B64=%q\n' "$(base64 -w0 "$root/deploy/Caddyfile")"
  cat "$root/scripts/deploy/remote.sh"
} > "$payload"

command_text="echo $(printf '%q' "$(base64 -w0 "$payload")") | base64 -d | bash"
params="$(jq -n --arg command "$command_text" '{commands: [$command]}')"

command_id="$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$AWS_INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "apply-tracker ${IMAGE_TAG}" \
  --timeout-seconds 900 \
  --parameters "$params" \
  --query Command.CommandId --output text)"

echo "SSM command ${command_id}"

status="Pending"
for _ in $(seq 1 90); do
  if status="$(aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$command_id" \
    --instance-id "$AWS_INSTANCE_ID" \
    --query Status --output text 2>/dev/null)"; then
    case "$status" in
      Success | Failed | Cancelled | TimedOut) break ;;
    esac
  fi
  sleep 10
done

aws ssm get-command-invocation \
  --region "$AWS_REGION" \
  --command-id "$command_id" \
  --instance-id "$AWS_INSTANCE_ID" \
  --query '[Status, StandardOutputContent, StandardErrorContent]' --output text || true

if [ "$status" != "Success" ]; then
  echo "Remote deploy failed (${status})" >&2
  exit 1
fi
