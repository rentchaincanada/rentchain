#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/rentchain-frontend"
PREVIEW_URL="${PREVIEW_URL:-http://localhost:5173}"
QA_ROLE="${QA_ROLE:-mobile}"
QA_SPEC="${QA_SPEC:-mobile-preview-smoke}"
QA_ARTIFACT_DIR="${QA_ARTIFACT_DIR:-test-results/${QA_ROLE}-mobile-smoke}"
QA_HTML_REPORT_DIR="${QA_HTML_REPORT_DIR:-playwright-report/${QA_ROLE}-mobile-smoke}"
ALLOW_PRODUCTION_QA="${ALLOW_PRODUCTION_QA:-false}"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Missing rentchain-frontend directory." >&2
  exit 1
fi

if [ ! -x "$FRONTEND_DIR/node_modules/.bin/playwright" ]; then
  echo "Playwright is unavailable. Run npm ci in rentchain-frontend first." >&2
  exit 1
fi

case "$PREVIEW_URL" in
  https://www.rentchain.ai*|https://rentchain.ai*)
    if [ "$ALLOW_PRODUCTION_QA" != "true" ]; then
      echo "Refusing to run mobile smoke against production URL without ALLOW_PRODUCTION_QA=true." >&2
      exit 1
    fi
    ;;
esac

echo "Running RentChain Playwright smoke."
echo "Role: $QA_ROLE"
echo "Target: $PREVIEW_URL"
echo "Spec filter: $QA_SPEC"
echo "Artifacts: $FRONTEND_DIR/$QA_ARTIFACT_DIR"
echo "HTML report: $FRONTEND_DIR/$QA_HTML_REPORT_DIR"

cd "$FRONTEND_DIR"
playwright_args=()
if [ -n "${QA_BROWSER:-}" ]; then
  playwright_args+=(--project="$QA_BROWSER")
fi
if [ -n "${QA_GREP:-}" ]; then
  playwright_args+=(--grep="$QA_GREP")
fi

export BASE_URL="$PREVIEW_URL"
export QA_ROLE
export QA_ARTIFACT_DIR
export QA_HTML_REPORT_DIR
if [ "${#playwright_args[@]}" -gt 0 ]; then
  npm run test:e2e -- "$QA_SPEC" "${playwright_args[@]}"
else
  npm run test:e2e -- "$QA_SPEC"
fi
