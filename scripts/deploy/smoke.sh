#!/usr/bin/env bash
# Poll the public health URL until the new deploy answers.
set -euo pipefail

base="${1:?usage: smoke.sh https://host}"
url="${base%/}/api/health"

for i in $(seq 1 36); do
  code="$(curl -sS -o /tmp/apply-tracker-health.json -w '%{http_code}' --max-time 15 "$url" || echo 000)"
  if [ "$code" = "200" ]; then
    echo "$url -> 200"
    cat /tmp/apply-tracker-health.json
    echo
    exit 0
  fi
  echo "attempt ${i}: $url -> ${code}"
  sleep 10
done

echo "Smoke test failed: $url did not return 200" >&2
exit 1
