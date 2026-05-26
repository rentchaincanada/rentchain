#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/rentchain-frontend"
PREVIEW_URL="${PREVIEW_URL:-http://localhost:5173}"
QA_ROLE="${QA_ROLE:-mobile}"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Missing rentchain-frontend directory." >&2
  exit 1
fi

if [ ! -x "$FRONTEND_DIR/node_modules/.bin/playwright" ]; then
  echo "Playwright is unavailable. Run npm ci in rentchain-frontend first." >&2
  exit 1
fi

echo "Running RentChain Playwright smoke."
echo "Role: $QA_ROLE"
echo "Target: $PREVIEW_URL"

cd "$FRONTEND_DIR"
playwright_args=()
if [ -n "${QA_BROWSER:-}" ]; then
  playwright_args+=(--project="$QA_BROWSER")
fi

BASE_URL="$PREVIEW_URL" npm run test:e2e -- "${playwright_args[@]}"
