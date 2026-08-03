#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
image="${1:-rentchain-production-runtime-validation:local}"
project="project-0d9658de-af29-4dc0-a99"
name="production-runtime-smoke-${RANDOM}-$$"
missing_name="${name}-missing-project"
wrong_name="${name}-wrong-project"
tmp="$(mktemp -d)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the backend immutable-image runtime contract test." >&2
  exit 2
fi

cleanup() {
  docker rm -f "${name}" "${missing_name}" "${wrong_name}" >/dev/null 2>&1 || true
  rm -rf "${tmp}"
}
trap cleanup EXIT

if test "$#" -eq 0; then
  docker build --platform linux/amd64 --file "${root}/rentchain-api/Dockerfile" --tag "${image}" "${root}/rentchain-api"
else
  docker image inspect "${image}" >/dev/null
fi

common_env=(
  --platform linux/amd64
  --env APP_ENV=production
  --env NODE_ENV=production
  --env PORT=8080
  --env JWT_SECRET=runtime-test-only
  --env PUBLIC_APP_URL=https://runtime.test.invalid
  --env STRIPE_SECRET_KEY=runtime-test-only
  --env STRIPE_WEBHOOK_SECRET=runtime-test-only
  --env INTERNAL_JOB_TOKEN=runtime-test-only
  --env FIREBASE_API_KEY=runtime-test-only
  --env STRIPE_PRICE_STARTER_MONTHLY_LIVE=runtime-test-only
  --env STRIPE_PRICE_PRO_MONTHLY_LIVE=runtime-test-only
  --env STRIPE_PRICE_ELITE_MONTHLY_LIVE=runtime-test-only
  --env EMAIL_PROVIDER=mailgun
  --env MAILGUN_API_KEY=runtime-test-only
  --env MAILGUN_DOMAIN=runtime.test.invalid
  --env EMAIL_FROM=runtime@runtime.test.invalid
)

set +e
docker run --name "${missing_name}" "${common_env[@]}" "${image}" >"${tmp}/missing-project.log" 2>&1
missing_status=$?
set -e
test "${missing_status}" -ne 0
grep -Fq 'Production requires GOOGLE_CLOUD_PROJECT to be explicitly configured.' "${tmp}/missing-project.log"

set +e
docker run --name "${wrong_name}" "${common_env[@]}" --env GOOGLE_CLOUD_PROJECT=rentchain-preview "${image}" >"${tmp}/wrong-project.log" 2>&1
wrong_status=$?
set -e
test "${wrong_status}" -ne 0
grep -Fq 'Production must target the approved production project.' "${tmp}/wrong-project.log"

docker run --detach --name "${name}" --publish 127.0.0.1::8080 "${common_env[@]}" --env GOOGLE_CLOUD_PROJECT="${project}" "${image}" >/dev/null
port="$(docker port "${name}" 8080/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "${port}" =~ ^[0-9]+$ ]]

status=""
for attempt in $(seq 1 30); do
  if ! docker inspect "${name}" --format '{{.State.Running}}' | grep -qx true; then
    docker logs "${name}" >&2 || true
    echo "Container exited before listening on port 8080." >&2
    exit 1
  fi
  if status="$(curl --silent --show-error --max-time 2 --output "${tmp}/health.json" --write-out '%{http_code}' "http://127.0.0.1:${port}/health")" && test "${status}" = 200; then
    break
  fi
  sleep 1
done

test "${status}" = 200
jq -e '.ok == true and .environment == "production" and .project == "project-0d9658de-af29-4dc0-a99"' "${tmp}/health.json" >/dev/null
docker logs "${name}" >"${tmp}/startup.log" 2>&1
grep -Fq 'about to listen' "${tmp}/startup.log"
grep -Fq 'listening on port 8080' "${tmp}/startup.log"
! grep -Fq 'Production requires GOOGLE_CLOUD_PROJECT' "${tmp}/startup.log"

printf 'Backend immutable-image runtime contract passed: process running, 0.0.0.0:8080 published, /health HTTP 200.\n'
