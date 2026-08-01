#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_PROJECT="project-0d9658de-af29-4dc0-a99"
readonly EXPECTED_REGION="us-central1"
readonly EXPECTED_SERVICE="rentchain-landlord-api"
readonly EXPECTED_IMAGE_PREFIX="us-central1-docker.pkg.dev/${EXPECTED_PROJECT}/rentchain-api/rentchain-landlord-api@sha256:"

mode="${1:-}"
source_sha="${2:-}"
image_uri="${3:-}"
project="${4:-}"
region="${5:-}"
service="${6:-}"

case "${mode}" in
  candidate|promotion) ;;
  *) echo "unsupported release validation mode" >&2; exit 2 ;;
esac

[[ "${source_sha}" =~ ^[0-9a-f]{40}$ ]] || { echo "source SHA must be 40 lowercase hexadecimal characters" >&2; exit 2; }
test "${project}" = "${EXPECTED_PROJECT}" || { echo "production project guard failed" >&2; exit 2; }
test "${region}" = "${EXPECTED_REGION}" || { echo "production region guard failed" >&2; exit 2; }
test "${service}" = "${EXPECTED_SERVICE}" || { echo "production service guard failed" >&2; exit 2; }
[[ "${image_uri}" =~ ^${EXPECTED_IMAGE_PREFIX}[0-9a-f]{64}$ ]] || {
  echo "immutable Production image digest is required" >&2
  exit 2
}

case "${image_uri}" in
  *rentchain-preview*|*preview-backend*)
    echo "Preview image is prohibited by the Production release guard" >&2
    exit 2
    ;;
esac

printf 'release_input_mode=%s\n' "${mode}"
printf 'source_sha_valid=true\n'
printf 'production_boundary_valid=true\n'
printf 'immutable_digest_valid=true\n'
