#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

expected_resources="$(cat <<'EOF'
google_iam_workload_identity_pool
google_iam_workload_identity_pool_provider
google_project_iam_custom_role
google_project_iam_member
google_project_service
google_service_account
google_service_account_iam_member
EOF
)"
actual_resources="$(rg -No 'resource "[^"]+"' "$root_dir" --glob '*.tf' | sed -E 's/.*resource "([^"]+)"/\1/' | sort -u)"
test "$actual_resources" = "$expected_resources"

test "$(rg -No '^resource "[^"]+"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "7"

test "$(rg -No 'service\s*=\s*"[^"]+\.googleapis\.com"' "$root_dir/services.tf" | wc -l | tr -d ' ')" = "0"
test "$(rg -No '"(cloudresourcemanager|iam|serviceusage)\.googleapis\.com"' "$root_dir/services.tf" | sort -u | wc -l | tr -d ' ')" = "3"

rg -q 'organization = "Rentchain"' "$root_dir/versions.tf"
rg -q 'name = "rentchain-preview-foundation"' "$root_dir/versions.tf"
rg -q 'var\.project_id == "rentchain-preview"' "$root_dir/variables.tf"
rg -q 'var\.project_number == "501298948635"' "$root_dir/variables.tf"
rg -q 'var\.environment == "preview"' "$root_dir/variables.tf"
rg -q 'var\.project_id != "project-0d9658de-af29-4dc0-a99"' "$root_dir/variables.tf"

if rg -n 'credentials\s*=|credentials_file|GOOGLE_APPLICATION_CREDENTIALS|service_account_key|private_key' "$root_dir" --glob '*.tf'; then
  echo "Static credential reference found" >&2
  exit 1
fi

if rg -n 'allUsers|allAuthenticatedUsers|google_cloud_run|google_artifact_registry|google_storage_bucket|google_firestore|google_compute|google_container|google_cloudbuild' "$root_dir" --glob '*.tf'; then
  echo "Public IAM or workload resource found" >&2
  exit 1
fi

rg -q 'workload_identity_pool_id = "github-preview-deploy"' "$root_dir/deployment_identity.tf"
rg -q 'workload_identity_pool_provider_id = "github"' "$root_dir/deployment_identity.tf"
rg -q 'issuer_uri = "https://token.actions.githubusercontent.com"' "$root_dir/deployment_identity.tf"
rg -q 'account_id   = "github-preview-deploy"' "$root_dir/deployment_identity.tf"
rg -q 'github_repository_id       = "1103977082"' "$root_dir/deployment_identity.tf"
rg -q 'github_repository_owner_id = "246115482"' "$root_dir/deployment_identity.tf"
rg -q 'github_trusted_event       = "workflow_dispatch"' "$root_dir/deployment_identity.tf"
rg -q 'github_trusted_workflow    = "rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main"' "$root_dir/deployment_identity.tf"
rg -q 'assertion.repository_id ==' "$root_dir/deployment_identity.tf"
rg -q 'assertion.repository_owner_id ==' "$root_dir/deployment_identity.tf"
rg -q 'assertion.event_name ==' "$root_dir/deployment_identity.tf"
rg -q 'assertion.job_workflow_ref ==' "$root_dir/deployment_identity.tf"
rg -q 'principal://iam.googleapis.com/projects/.*subject/' "$root_dir/deployment_identity.tf"

test "$(rg -No '"(resourcemanager.projects.get|serviceusage.services.get|serviceusage.services.list)"' "$root_dir/deployment_identity.tf" | sort -u | wc -l | tr -d ' ')" = "3"

if rg -n 'roles/(owner|editor|run\.admin|artifactregistry\.writer|cloudbuild\.builds\.editor|iam\.serviceAccountTokenCreator|iam\.serviceAccountUser|storage\.admin)|google_service_account_key|principalSet://.*/workloadIdentityPools/github-preview-deploy/\*' "$root_dir" --glob '*.tf'; then
  echo "Broad deployment permission, static key, or wildcard federation found" >&2
  exit 1
fi

echo "Preview foundation scope validation passed"
