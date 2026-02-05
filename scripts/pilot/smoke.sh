#!/usr/bin/env bash
set -euo pipefail

API_HOST=${1:-"https://rentchain-landlord-api-915921057662.us-central1.run.app"}

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; }

pricing=$(curl -s -o /tmp/pricing.json -w "%{http_code}" "$API_HOST/api/health/pricing" || true)
if [[ "$pricing" == "200" ]]; then
  if grep -q '"ok":true' /tmp/pricing.json; then
    pass "pricing health"
  else
    fail "pricing health (ok=false)" && cat /tmp/pricing.json
  fi
else
  fail "pricing health (HTTP $pricing)"
fi

provider=$(curl -s -o /tmp/provider.json -w "%{http_code}" "$API_HOST/api/health/screening-provider" || true)
if [[ "$provider" == "200" ]]; then
  if grep -q '"ok":true' /tmp/provider.json; then
    pass "screening provider health"
  else
    fail "screening provider health (ok=false)" && cat /tmp/provider.json
  fi
else
  fail "screening provider health (HTTP $provider)"
fi
