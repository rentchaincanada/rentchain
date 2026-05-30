#!/usr/bin/env bash
set -euo pipefail

PREVIEW_URL="${PREVIEW_URL:-}"
BACKEND_BASE_URL="${BACKEND_BASE_URL:-}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-${EXPECTED_BACKEND_COMMIT:-}}"
EXPECTED_REVISION="${EXPECTED_REVISION:-}"
EXPECTED_IMAGE_TAG="${EXPECTED_IMAGE_TAG:-}"
ALLOW_PRODUCTION_QA="${ALLOW_PRODUCTION_QA:-false}"
VERIFY_TIMEOUT_SECONDS="${VERIFY_TIMEOUT_SECONDS:-10}"
VERIFY_PUBLIC_SIGNAL_ONLY="${VERIFY_PUBLIC_SIGNAL_ONLY:-false}"

if [ -z "$PREVIEW_URL" ]; then
  echo "PREVIEW_URL is required." >&2
  echo "Example: PREVIEW_URL=https://example-preview.vercel.app EXPECTED_COMMIT=<sha> tools/qa/verify-cloud-run-preview-revision.sh" >&2
  exit 2
fi

if [ "$VERIFY_PUBLIC_SIGNAL_ONLY" != "true" ] && [ -z "$EXPECTED_COMMIT" ] && [ -z "$EXPECTED_REVISION" ] && [ -z "$EXPECTED_IMAGE_TAG" ]; then
  echo "Set at least one expected backend identifier: EXPECTED_COMMIT, EXPECTED_REVISION, or EXPECTED_IMAGE_TAG." >&2
  echo "For public reachability only, set VERIFY_PUBLIC_SIGNAL_ONLY=true." >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for preview revision verification." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to normalize PREVIEW_URL/BACKEND_BASE_URL." >&2
  exit 1
fi

normalize_origin() {
  node -e '
    try {
      const url = new URL(process.argv[1]);
      console.log(url.origin);
    } catch (err) {
      console.error(`Invalid URL: ${process.argv[1]}`);
      process.exit(1);
    }
  ' "$1"
}

frontend_origin="$(normalize_origin "$PREVIEW_URL")"
backend_origin="$(normalize_origin "${BACKEND_BASE_URL:-$PREVIEW_URL}")"

case "$frontend_origin" in
  https://www.rentchain.ai|https://rentchain.ai)
    if [ "$ALLOW_PRODUCTION_QA" != "true" ]; then
      echo "Refusing to verify production URL without ALLOW_PRODUCTION_QA=true." >&2
      exit 1
    fi
    ;;
esac

case "$backend_origin" in
  https://www.rentchain.ai|https://rentchain.ai)
    if [ "$ALLOW_PRODUCTION_QA" != "true" ]; then
      echo "Refusing to verify production backend URL without ALLOW_PRODUCTION_QA=true." >&2
      exit 1
    fi
    ;;
esac

expected_tokens=()
add_token() {
  local token="$1"
  local existing
  if [ -z "$token" ]; then
    return
  fi
  if [ "${#expected_tokens[@]}" -gt 0 ]; then
    for existing in "${expected_tokens[@]}"; do
      if [ "$existing" = "$token" ]; then
        return
      fi
    done
  fi
  expected_tokens+=("$token")
}

add_token "$EXPECTED_COMMIT"
if [[ "$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{7,}$ ]]; then
  if [ "${#EXPECTED_COMMIT}" -ge 7 ]; then
    add_token "${EXPECTED_COMMIT:0:7}"
  fi
  if [ "${#EXPECTED_COMMIT}" -ge 8 ]; then
    add_token "${EXPECTED_COMMIT:0:8}"
  fi
  if [ "${#EXPECTED_COMMIT}" -ge 12 ]; then
    add_token "${EXPECTED_COMMIT:0:12}"
  fi
fi
add_token "$EXPECTED_REVISION"
add_token "$EXPECTED_IMAGE_TAG"

endpoints=(
  "/health"
  "/health/db"
  "/health/ready"
  "/api/health"
  "/api/_build"
  "/api/__probe/version"
  "/api/__probe/revision"
  "/api/__debug/build"
  "/api/_echo"
  "/__probe/revision"
)

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

confirmed="false"
public_signal_confirmed="false"
reachable="false"
server_error="false"

echo "RentChain Cloud Run preview revision verification"
echo "Frontend preview: $frontend_origin"
echo "Backend probe origin: $backend_origin"
if [ "$VERIFY_PUBLIC_SIGNAL_ONLY" = "true" ]; then
  echo "Mode: public signal only"
else
  echo "Expected tokens:"
  for token in "${expected_tokens[@]}"; do
    echo "  - $token"
  done
fi
echo

for endpoint in "${endpoints[@]}"; do
  url="${backend_origin}${endpoint}"
  headers_file="$tmp_dir/headers"
  body_file="$tmp_dir/body"
  combined_file="$tmp_dir/combined"
  method="GET"
  if [ "$endpoint" = "/api/_echo" ]; then
    method="POST"
  fi

  echo "Checking $endpoint ($method)"
  status="$(
    curl \
      --silent \
      --show-error \
      --location \
      --request "$method" \
      --max-time "$VERIFY_TIMEOUT_SECONDS" \
      --dump-header "$headers_file" \
      --output "$body_file" \
      --write-out "%{http_code}" \
      "$url" 2>"$tmp_dir/curl-error" || true
  )"

  if [ -s "$tmp_dir/curl-error" ]; then
    echo "  curl: $(tr '\n' ' ' < "$tmp_dir/curl-error")"
  fi

  if [[ "$status" =~ ^[0-9][0-9][0-9]$ ]] && [ "$status" != "000" ]; then
    echo "  status: $status"
    if [ "$status" -lt 500 ]; then
      reachable="true"
    else
      server_error="true"
    fi
  else
    echo "  status: unavailable"
  fi

  if [ -s "$headers_file" ]; then
    awk '
      {
        line = tolower($0);
      }
      line ~ /^x-route-source:|^server:|^via:|^x-vercel-id:|^x-cloud-trace-context:|^x-powered-by:/ {
        gsub(/\r/, "");
        print "  " $0;
      }
    ' "$headers_file"
  fi

  cat "$headers_file" "$body_file" > "$combined_file" 2>/dev/null || true
  if [ "$VERIFY_PUBLIC_SIGNAL_ONLY" != "true" ]; then
    for token in "${expected_tokens[@]}"; do
      if grep -Fq "$token" "$combined_file"; then
        echo "  matched expected token: $token"
        confirmed="true"
      fi
    done
  fi

  if [ -s "$body_file" ]; then
    body_preview="$(head -c 600 "$body_file" | tr '\n' ' ' | sed 's/[[:space:]][[:space:]]*/ /g')"
    echo "  body preview: $body_preview"
  fi

  if [ "$VERIFY_PUBLIC_SIGNAL_ONLY" = "true" ] && [ "$endpoint" = "/health" ]; then
    if grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body_file" \
      && grep -Eq '"revisionPresent"[[:space:]]*:[[:space:]]*true' "$body_file"; then
      echo "  public signal: ok with revision metadata present"
      public_signal_confirmed="true"
    fi
  fi
  echo
done

if [ "$VERIFY_PUBLIC_SIGNAL_ONLY" = "true" ]; then
  if [ "$public_signal_confirmed" = "true" ]; then
    echo "Verified: public health signal is reachable and reports revision metadata presence."
    echo "Exact commit/revision/image identity was not verified in public signal mode."
    exit 0
  fi

  echo "Could not confirm the public Cloud Run revision signal from /health." >&2
  if [ "$reachable" != "true" ]; then
    echo "No safe endpoint returned a reachable non-5xx response." >&2
  fi
  if [ "$server_error" = "true" ]; then
    echo "One or more endpoints returned 5xx and should be reviewed separately." >&2
  fi
  exit 1
fi

if [ "$confirmed" = "true" ]; then
  echo "Verified: backend response data contains at least one expected revision/commit/image token."
  exit 0
fi

echo "Could not confirm the expected backend revision/commit/image from safe preview endpoints." >&2
if [ "$reachable" != "true" ]; then
  echo "No safe endpoint returned a reachable non-5xx response." >&2
fi
if [ "$server_error" = "true" ]; then
  echo "One or more endpoints returned 5xx and should be reviewed separately." >&2
fi
echo "If Cloud Run was recently deployed, verify the active revision/image and 100% traffic with docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md." >&2
exit 1
