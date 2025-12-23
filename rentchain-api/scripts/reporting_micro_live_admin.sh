#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
SUBMISSION_ID="${SUBMISSION_ID:-}"

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ADMIN_TOKEN is required" >&2
  exit 1
fi
if [[ -z "$SUBMISSION_ID" ]]; then
  echo "SUBMISSION_ID is required" >&2
  exit 1
fi

auth_header=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

maybe_jq() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

echo "Approve submission"
curl -s -X POST "${auth_header[@]}" -H "Content-Type: application/json" \
  -d "{\"submissionId\":\"${SUBMISSION_ID}\"}" \
  "${API_BASE}/api/admin/reporting/micro-live/approve" | maybe_jq

echo ""
echo "Submit (live)"
curl -s -X POST "${auth_header[@]}" -H "Content-Type: application/json" \
  -d "{\"submissionId\":\"${SUBMISSION_ID}\"}" \
  "${API_BASE}/api/admin/reporting/micro-live/submit" | maybe_jq

echo ""
echo "Done."
