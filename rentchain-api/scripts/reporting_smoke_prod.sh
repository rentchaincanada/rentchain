#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ADMIN_TOKEN is required" >&2
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

echo "1) Metrics"
curl -s "${auth_header[@]}" "${API_BASE}/api/admin/reporting/metrics?days=7" | maybe_jq

echo ""
echo "2) Providers"
curl -s "${auth_header[@]}" "${API_BASE}/api/admin/reporting/providers" | maybe_jq

echo ""
echo "3) Pause"
curl -s -X POST "${auth_header[@]}" "${API_BASE}/api/admin/reporting/pause" | maybe_jq

echo ""
echo "4) Resume"
curl -s -X POST "${auth_header[@]}" "${API_BASE}/api/admin/reporting/resume" | maybe_jq

echo ""
echo "5) Sweep-stuck (dry-run)"
curl -s -X POST "${auth_header[@]}" -H "Content-Type: application/json" \
  -d '{"dryRun":true}' \
  "${API_BASE}/api/admin/reporting/sweep-stuck" | maybe_jq

echo ""
echo "Smoke script completed."
