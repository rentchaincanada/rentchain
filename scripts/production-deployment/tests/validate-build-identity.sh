#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
identity="${root}/production_cloudbuild_identity.tf"
build="${root}/rentchain-api/cloudbuild.yaml"

test -f "${identity}"
test -f "${build}"

grep -Fq 'account_id   = "rentchain-cloudbuild-builder"' "${identity}"
grep -Fq 'resource "google_service_account" "production_cloudbuild_builder"' "${identity}"
grep -Fq 'resource "google_project_iam_custom_role" "production_cloudbuild_artifact_publisher"' "${identity}"
grep -Fq 'resource "google_artifact_registry_repository_iam_member" "production_cloudbuild_artifact_publisher"' "${identity}"
rg -q 'production_cloudbuild_repository\s*= "rentchain-api"' "${identity}"
rg -q 'production_cloudbuild_region\s*= "us-central1"' "${identity}"
grep -Fq 'repository = local.production_cloudbuild_repository' "${identity}"
grep -Fq 'location   = local.production_cloudbuild_region' "${identity}"
grep -Fq 'resource "google_project_iam_member" "production_cloudbuild_log_writer"' "${identity}"
grep -Fq 'role    = "roles/logging.logWriter"' "${identity}"

actual_permissions="$({
  sed -n '/production_cloudbuild_artifact_publisher_permissions = toset(/,/])/p' "${identity}" \
    | rg -No '"artifactregistry\.[^"]+"' \
    | tr -d '"' \
    | sort -u
})"
expected_permissions="$(cat <<'EOF'
artifactregistry.dockerimages.get
artifactregistry.repositories.downloadArtifacts
artifactregistry.repositories.get
artifactregistry.repositories.uploadArtifacts
artifactregistry.tags.create
artifactregistry.tags.get
EOF
)"
test "${actual_permissions}" = "${expected_permissions}"
test "$(printf '%s\n' "${actual_permissions}" | wc -l | tr -d ' ')" = "6"

forbidden='roles/(owner|editor|run\.admin|run\.developer|resourcemanager\.projectIamAdmin|iam\.securityAdmin|iam\.serviceAccountAdmin|iam\.serviceAccountUser|iam\.serviceAccountTokenCreator|artifactregistry\.admin|artifactregistry\.writer|storage\.admin|secretmanager\.(admin|secretAccessor)|cloudbuild\.(builds\.(builder|editor)|connectionAdmin))|run\.(services\.(update|setIamPolicy)|routes\.invoke)|resourcemanager\.projects\.setIamPolicy|iam\.roles\.(create|update)|cloudbuild\.triggers\.(update|delete)|secretmanager\.versions\.access|google_service_account_key'
if rg -n "${forbidden}" "${identity}"; then
  echo "Forbidden Production build-identity capability found" >&2
  exit 1
fi

if rg -n 'gcloud run|update-traffic|terraform apply|set-iam-policy|add-iam-policy-binding|remove-iam-policy-binding|secrets versions access' "${build}"; then
  echo "Automatic build path contains a governed mutation command" >&2
  exit 1
fi

test "$(rg -n 'resource "google_service_account"' "${identity}" | wc -l | tr -d ' ')" = "1"
test "$(rg -n 'resource "google_artifact_registry_repository_iam_member"' "${identity}" | wc -l | tr -d ' ')" = "1"
test "$(rg -n 'resource "google_project_iam_member"' "${identity}" | wc -l | tr -d ' ')" = "1"
test "$(rg -n 'resource "google_cloudbuild_trigger"' "${identity}" | wc -l | tr -d ' ')" = "0"

printf '%s\n' 'Production Cloud Build identity validation passed (20 boundaries).'
