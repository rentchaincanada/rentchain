#!/usr/bin/env bash
set -euo pipefail

build_required=false
no_build_only=true

classify() {
  local path="$1"
  case "${path}" in
    rentchain-api/src/*|rentchain-api/scripts/*|rentchain-api/Dockerfile|rentchain-api/.dockerignore|rentchain-api/package.json|rentchain-api/package-lock.json|rentchain-api/tsconfig*.json|rentchain-api/cloudbuild*.yaml|rentchain-api/cloudbuild*.yml)
      printf 'build-required\t%s\n' "${path}"
      build_required=true
      no_build_only=false
      ;;
    infra/environments/preview-foundation/*|docs/*|rentchain-frontend/*|rentchain-status/*)
      printf 'no-build\t%s\n' "${path}"
      ;;
    *)
      printf 'review-required\t%s\n' "${path}"
      no_build_only=false
      ;;
  esac
}

if (( "$#" > 0 )); then
  for path in "$@"; do classify "${path}"; done
else
  while IFS= read -r path; do
    test -n "${path}" && classify "${path}"
  done
fi

printf 'build_required=%s\n' "${build_required}"
printf 'no_build_only=%s\n' "${no_build_only}"
printf 'deployment_authorized=false\n'
