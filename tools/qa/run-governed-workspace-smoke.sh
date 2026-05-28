#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="$ROOT_DIR/rentchain-api"
FRONTEND_DIR="$ROOT_DIR/rentchain-frontend"
RESULTS_DIR="$ROOT_DIR/test-results/governed-workspace-smoke"
SUMMARY_FILE="$RESULTS_DIR/summary.md"
API_BASE_URL="${API_BASE_URL:-${VITE_API_BASE_URL:-http://localhost:8080}}"
PREVIEW_URL="${PREVIEW_URL:-http://localhost:5173}"
RUN_FRONTEND_SMOKE="${RUN_FRONTEND_SMOKE:-true}"
QA_GREP_PATTERN="${QA_GREP_PATTERN:-admin review workspaces}"

mkdir -p "$RESULTS_DIR"

backend_status=0
frontend_status=0

echo "Running governed workspace smoke verification."
echo "API base URL: $API_BASE_URL"
echo "Frontend target: $PREVIEW_URL"
echo "Results: $RESULTS_DIR"

if [ ! -d "$API_DIR" ]; then
  echo "Missing rentchain-api directory." >&2
  exit 1
fi

cd "$API_DIR"
API_BASE_URL="$API_BASE_URL" npm run test:single -- src/routes/__tests__/governedReviewWorkspaceSmoke.test.ts || backend_status=$?

if [ "$RUN_FRONTEND_SMOKE" = "true" ]; then
  if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Missing rentchain-frontend directory." >&2
    exit 1
  fi
  if [ ! -x "$FRONTEND_DIR/node_modules/.bin/playwright" ]; then
    echo "Playwright is unavailable. Run npm ci in rentchain-frontend first." >&2
    exit 1
  fi

  cd "$FRONTEND_DIR"
  export BASE_URL="$PREVIEW_URL"
  export VITE_API_BASE_URL="$API_BASE_URL"
  export QA_ARTIFACT_DIR="$RESULTS_DIR/playwright-artifacts"
  export QA_HTML_REPORT_DIR="$RESULTS_DIR/playwright-report"
  export QA_JSON_REPORT_FILE="$RESULTS_DIR/playwright-results.json"
  npm run test:e2e -- admin-smoke.spec.ts --grep "$QA_GREP_PATTERN" || frontend_status=$?
else
  echo "Frontend smoke skipped because RUN_FRONTEND_SMOKE=false."
fi

pass_count=0
fail_count=0
if [ "$backend_status" -eq 0 ]; then pass_count=$((pass_count + 1)); else fail_count=$((fail_count + 1)); fi
if [ "$RUN_FRONTEND_SMOKE" = "true" ]; then
  if [ "$frontend_status" -eq 0 ]; then pass_count=$((pass_count + 1)); else fail_count=$((fail_count + 1)); fi
fi

{
  echo "# Governed Workspace Smoke Summary"
  echo
  echo "- API base URL: $API_BASE_URL"
  echo "- Frontend target: $PREVIEW_URL"
  echo "- Backend smoke: $([ "$backend_status" -eq 0 ] && echo pass || echo fail)"
  if [ "$RUN_FRONTEND_SMOKE" = "true" ]; then
    echo "- Frontend smoke: $([ "$frontend_status" -eq 0 ] && echo pass || echo fail)"
  else
    echo "- Frontend smoke: skipped"
  fi
  echo "- Pass count: $pass_count"
  echo "- Fail count: $fail_count"
} > "$SUMMARY_FILE"

cat "$SUMMARY_FILE"

if [ "$backend_status" -ne 0 ]; then
  exit "$backend_status"
fi
if [ "$frontend_status" -ne 0 ]; then
  exit "$frontend_status"
fi
