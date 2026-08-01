#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
source_reader="${root}/production_cloudbuild_source_object_reader.tf"
identity="${root}/production_cloudbuild_identity.tf"
build="${root}/rentchain-api/cloudbuild.yaml"

test -f "${source_reader}"
grep -Fq 'role_id     = "productionCloudBuildSourceObjectReader"' "${source_reader}"
grep -Fq '"storage.objects.get"' "${source_reader}"
test "$(rg -No '"storage\.[^"]+"' "${source_reader}" | sort -u)" = '"storage.objects.get"'
test "$(rg -n 'storage\.objects\.list' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'storage\.objects\.create' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'storage\.objects\.update' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'storage\.objects\.delete' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'storage\.buckets\.' "${source_reader}" | wc -l | tr -d ' ')" = "0"
grep -Fq 'resource "google_storage_bucket_iam_member" "production_cloudbuild_source_object_reader"' "${source_reader}"
grep -Fq 'production_cloudbuild_source_bucket = "project-0d9658de-af29-4dc0-a99_cloudbuild"' "${source_reader}"
grep -Fq 'member = local.production_cloudbuild_builder_member' "${source_reader}"
test "$(rg -n 'google_project_iam_member' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'roles/storage\.(admin|objectAdmin|objectViewer)' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'google_cloudbuild_trigger' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'run\.|secretmanager\.' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'serviceAccount(User|TokenCreator)|workloadIdentityUser' "${source_reader}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'prevent_destroy = true' "${source_reader}" | wc -l | tr -d ' ')" = "2"
test "$(rg -No '"artifactregistry\.[^"]+"' "${identity}" | sort -u | wc -l | tr -d ' ')" = "6"
grep -Fq 'role    = "roles/logging.logWriter"' "${identity}"
test "$(rg -n 'gcloud run|terraform apply|secrets versions access' "${build}" | wc -l | tr -d ' ')" = "0"

printf '%s\n' 'Production Cloud Build source-object reader validation passed (20 boundaries).'
