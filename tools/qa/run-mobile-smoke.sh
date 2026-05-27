#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/rentchain-frontend"
PREVIEW_URL="${PREVIEW_URL:-http://localhost:5173}"
QA_ROLE="${QA_ROLE:-mobile}"
QA_SPEC="${QA_SPEC:-mobile-preview-smoke}"
if [ "$QA_ROLE" = "mobile" ]; then
  default_artifact_dir="test-results/mobile-smoke"
  default_html_report_dir="playwright-report/mobile-smoke"
else
  default_artifact_dir="test-results/${QA_ROLE}-smoke"
  default_html_report_dir="playwright-report/${QA_ROLE}-smoke"
fi
QA_ARTIFACT_DIR="${QA_ARTIFACT_DIR:-$default_artifact_dir}"
QA_HTML_REPORT_DIR="${QA_HTML_REPORT_DIR:-$default_html_report_dir}"
QA_JSON_REPORT_FILE="${QA_JSON_REPORT_FILE:-${QA_ARTIFACT_DIR}/qa-results.json}"
QA_MARKDOWN_REPORT_FILE="${QA_MARKDOWN_REPORT_FILE:-${QA_ARTIFACT_DIR}/qa-summary.md}"
QA_REVIEW_PACK_FILE="${QA_REVIEW_PACK_FILE:-${QA_ARTIFACT_DIR}/qa-review-pack.md}"
QA_REVIEW_PACK_JSON_FILE="${QA_REVIEW_PACK_JSON_FILE:-${QA_ARTIFACT_DIR}/qa-review-pack.json}"
QA_REVISION_VERIFICATION_FILE="${QA_REVISION_VERIFICATION_FILE:-}"
ALLOW_PRODUCTION_QA="${ALLOW_PRODUCTION_QA:-false}"

role_storage_key=""
role_storage_state=""
case "$QA_ROLE" in
  admin|landlord|tenant)
    role_storage_key="QA_$(printf "%s" "$QA_ROLE" | tr '[:lower:]' '[:upper:]')_STORAGE_STATE"
    role_storage_state="${!role_storage_key:-}"
    ;;
esac
fallback_storage_state="${QA_STORAGE_STATE:-}"

auth_mode="unauthenticated"
auth_source=""
auth_storage_state=""
if [ -n "$role_storage_state" ]; then
  auth_mode="authenticated"
  auth_source="$role_storage_key"
  auth_storage_state="$role_storage_state"
elif [ -n "$fallback_storage_state" ]; then
  auth_mode="authenticated"
  auth_source="QA_STORAGE_STATE"
  auth_storage_state="$fallback_storage_state"
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Missing rentchain-frontend directory." >&2
  exit 1
fi

if [ ! -x "$FRONTEND_DIR/node_modules/.bin/playwright" ]; then
  echo "Playwright is unavailable. Run npm ci in rentchain-frontend first." >&2
  exit 1
fi

if [ -n "$auth_storage_state" ] && [ ! -f "$auth_storage_state" ]; then
  echo "Storage-state file from $auth_source was not found." >&2
  echo "Keep storage-state JSON outside the repo or under ignored test-results paths." >&2
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
if [ "$auth_mode" = "authenticated" ]; then
  echo "Auth mode: authenticated storage state provided via $auth_source"
else
  echo "Auth mode: unauthenticated smoke; protected routes may be auth-gated"
fi
echo "Artifacts: $FRONTEND_DIR/$QA_ARTIFACT_DIR"
echo "HTML report: $FRONTEND_DIR/$QA_HTML_REPORT_DIR"
echo "JSON report: $FRONTEND_DIR/$QA_JSON_REPORT_FILE"
echo "QA summary: $FRONTEND_DIR/$QA_MARKDOWN_REPORT_FILE"
echo "Claude QA review pack: $FRONTEND_DIR/$QA_REVIEW_PACK_FILE"
echo "Claude QA review pack JSON: $FRONTEND_DIR/$QA_REVIEW_PACK_JSON_FILE"
if [ -n "$QA_REVISION_VERIFICATION_FILE" ]; then
  echo "Revision verification artifact: $QA_REVISION_VERIFICATION_FILE"
else
  echo "Revision verification artifact: not provided"
fi

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
export QA_JSON_REPORT_FILE
export QA_MARKDOWN_REPORT_FILE
export QA_REVIEW_PACK_FILE
export QA_REVIEW_PACK_JSON_FILE
test_status=0
if [ "${#playwright_args[@]}" -gt 0 ]; then
  npm run test:e2e -- "$QA_SPEC" "${playwright_args[@]}" || test_status=$?
else
  npm run test:e2e -- "$QA_SPEC" || test_status=$?
fi

report_status=0
node "$ROOT_DIR/tools/qa/generate-playwright-qa-report.mjs" \
  --input "$FRONTEND_DIR/$QA_JSON_REPORT_FILE" \
  --output "$FRONTEND_DIR/$QA_MARKDOWN_REPORT_FILE" \
  --preview-url "$PREVIEW_URL" \
  --role "$QA_ROLE" \
  --spec "$QA_SPEC" \
  --artifact-dir "$FRONTEND_DIR/$QA_ARTIFACT_DIR" \
  --html-report "$FRONTEND_DIR/$QA_HTML_REPORT_DIR" || report_status=$?

review_pack_args=()
if [ -n "$QA_REVISION_VERIFICATION_FILE" ]; then
  review_pack_args+=(--revision-file "$QA_REVISION_VERIFICATION_FILE")
fi

if [ "${#review_pack_args[@]}" -gt 0 ]; then
  node "$ROOT_DIR/tools/qa/generate-claude-qa-review-pack.mjs" \
    --input "$FRONTEND_DIR/$QA_JSON_REPORT_FILE" \
    --output "$FRONTEND_DIR/$QA_REVIEW_PACK_FILE" \
    --json-output "$FRONTEND_DIR/$QA_REVIEW_PACK_JSON_FILE" \
    --preview-url "$PREVIEW_URL" \
    --role "$QA_ROLE" \
    --spec "$QA_SPEC" \
    --auth-mode "$auth_mode" \
    --artifact-dir "$FRONTEND_DIR/$QA_ARTIFACT_DIR" \
    --html-report "$FRONTEND_DIR/$QA_HTML_REPORT_DIR" \
    "${review_pack_args[@]}" || report_status=$?
else
  node "$ROOT_DIR/tools/qa/generate-claude-qa-review-pack.mjs" \
    --input "$FRONTEND_DIR/$QA_JSON_REPORT_FILE" \
    --output "$FRONTEND_DIR/$QA_REVIEW_PACK_FILE" \
    --json-output "$FRONTEND_DIR/$QA_REVIEW_PACK_JSON_FILE" \
    --preview-url "$PREVIEW_URL" \
    --role "$QA_ROLE" \
    --spec "$QA_SPEC" \
    --auth-mode "$auth_mode" \
    --artifact-dir "$FRONTEND_DIR/$QA_ARTIFACT_DIR" \
    --html-report "$FRONTEND_DIR/$QA_HTML_REPORT_DIR" || report_status=$?
fi

if [ "$report_status" -ne 0 ]; then
  echo "QA report generation failed with status $report_status." >&2
fi

if [ "$test_status" -ne 0 ]; then
  exit "$test_status"
fi

exit "$report_status"
