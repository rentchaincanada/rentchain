#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
probe_dir="${repo_root}/rentchain-api/secrets"
probe_path="${probe_dir}/__cloud_build_exclusion_probe__.json"
named_probe_path="${repo_root}/__cloud_build_service-account_probe__.json"
source_list="$(mktemp)"

cleanup() {
  rm -f "${probe_path}" "${named_probe_path}" "${source_list}"
  rmdir "${probe_dir}" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "${probe_dir}"
printf '{"synthetic":true}\n' > "${probe_path}"
printf '{"synthetic":true}\n' > "${named_probe_path}"

gcloud meta list-files-for-upload "${repo_root}" > "${source_list}"

if grep -Fq 'rentchain-api/secrets/' "${source_list}"; then
  printf 'Cloud Build source exclusion failed for the protected secrets path.\n' >&2
  exit 1
fi

if grep -Eq '(^|/)[^/]*service-account[^/]*\.json$' "${source_list}"; then
  printf 'Cloud Build source exclusion failed for a service-account JSON path.\n' >&2
  exit 1
fi

for required_path in \
  'Dockerfile' \
  'rentchain-api/Dockerfile' \
  'rentchain-api/package.json' \
  'rentchain-api/package-lock.json' \
  'rentchain-api/src/index.ts'; do
  if ! grep -Fxq "${required_path}" "${source_list}"; then
    printf 'Required Cloud Build source path is missing: %s\n' "${required_path}" >&2
    exit 1
  fi
done

for ignore_file in \
  "${repo_root}/.dockerignore" \
  "${repo_root}/rentchain-api/.dockerignore"; do
  if ! grep -Fq '**/*service-account*.json' "${ignore_file}"; then
    printf 'Docker credential exclusion is missing from: %s\n' "${ignore_file}" >&2
    exit 1
  fi
done

printf 'Cloud Build source exclusions validated.\n'
