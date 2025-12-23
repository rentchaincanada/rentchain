#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
LANDLORD_TOKEN="${LANDLORD_TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"
MONTHS="${MONTHS:-3}"

if [[ -z "$LANDLORD_TOKEN" ]]; then
  echo "LANDLORD_TOKEN is required" >&2
  exit 1
fi
if [[ -z "$TENANT_ID" ]]; then
  echo "TENANT_ID is required" >&2
  exit 1
fi

auth_header=(-H "Authorization: Bearer ${LANDLORD_TOKEN}")

maybe_jq() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

echo "Shadow prepare"
curl -s -X POST "${auth_header[@]}" -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"months\":${MONTHS}}" \
  "${API_BASE}/api/landlord/reporting/shadow/prepare" | maybe_jq

echo ""
echo "Shadow status"
curl -s "${auth_header[@]}" "${API_BASE}/api/landlord/reporting/shadow/status?tenantId=${TENANT_ID}" | maybe_jq

echo ""
echo "Done."
