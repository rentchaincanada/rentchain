#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "$root_dir/../../.." && pwd)"
workflow_file="$repo_dir/.github/workflows/preview-deployment-identity-validation.yml"
apply_permissions_file="$root_dir/tests/hcp_apply_permissions.txt"
b4_apply_delta_file="$root_dir/tests/hcp_b4_apply_permission_delta.txt"

expected_resources="$(cat <<'EOF'
google_artifact_registry_repository
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

test "$(rg -No '^resource "[^"]+"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "9"

test "$(rg -No 'service\s*=\s*"[^"]+\.googleapis\.com"' "$root_dir/services.tf" | wc -l | tr -d ' ')" = "0"
test "$(rg -No '"(artifactregistry|cloudresourcemanager|iam|run|serviceusage)\.googleapis\.com"' "$root_dir/services.tf" | sort -u | wc -l | tr -d ' ')" = "5"

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

if rg -n 'allUsers|allAuthenticatedUsers|google_cloud_run|google_storage_bucket|google_firestore|google_compute|google_container|google_cloudbuild' "$root_dir" --glob '*.tf'; then
  echo "Public IAM or workload resource found" >&2
  exit 1
fi

test "$(rg -No '^resource "google_artifact_registry_repository"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "1"
rg -q 'project       = var\.project_id' "$root_dir/deployment_foundation.tf"
rg -q 'preview_deployment_region = "northamerica-northeast1"' "$root_dir/deployment_foundation.tf"
rg -q 'preview_repository_id     = "rentchain-preview"' "$root_dir/deployment_foundation.tf"
rg -q 'preview_repository_format = "DOCKER"' "$root_dir/deployment_foundation.tf"
rg -q 'immutable_tags = true' "$root_dir/deployment_foundation.tf"
rg -q 'keep_recent_tagged_count = 15' "$root_dir/deployment_foundation.tf"
rg -q 'delete_untagged_after    = "604800s"' "$root_dir/deployment_foundation.tf"
rg -q 'account_id   = "preview-backend-runtime"' "$root_dir/deployment_foundation.tf"

if rg -n 'preview_backend_runtime.*(role|member|iam)|roles/iam\.serviceAccountUser' "$root_dir" --glob '*.tf'; then
  echo "The future Preview runtime identity must remain role-less and non-delegable in B4" >&2
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

expected_apply_permissions="$(cat <<'EOF'
iam.googleapis.com/workloadIdentityPoolProviders.create
iam.googleapis.com/workloadIdentityPoolProviders.get
iam.googleapis.com/workloadIdentityPools.create
iam.googleapis.com/workloadIdentityPools.get
iam.roles.create
iam.roles.get
iam.serviceAccounts.create
iam.serviceAccounts.get
iam.serviceAccounts.getIamPolicy
iam.serviceAccounts.setIamPolicy
resourcemanager.projects.get
resourcemanager.projects.getIamPolicy
resourcemanager.projects.setIamPolicy
serviceusage.services.enable
serviceusage.services.get
serviceusage.services.list
EOF
)"
test "$(sort -u "$apply_permissions_file")" = "$expected_apply_permissions"
test "$(wc -l < "$apply_permissions_file" | tr -d ' ')" = "16"

expected_b4_apply_delta="$(cat <<'EOF'
artifactregistry.repositories.create
artifactregistry.repositories.get
EOF
)"
test "$(sort -u "$b4_apply_delta_file")" = "$expected_b4_apply_delta"
test "$(wc -l < "$b4_apply_delta_file" | tr -d ' ')" = "2"

if rg -n '(delete|update|setIamPolicy|serviceusage\.services\.enable|serviceAccountKeys|signBlob|signJwt|getAccessToken|generateAccessToken|run\.|cloudbuild\.|storage\.|firebase|firestore|billing)' "$b4_apply_delta_file"; then
  echo "Forbidden B4 apply-permission delta found" >&2
  exit 1
fi

if rg -n '(delete|undelete|update|workloadIdentityPools\.list|workloadIdentityPoolProviders\.list|serviceAccounts\.list|roles\.list|serviceAccountKeys|signBlob|signJwt|getAccessToken|generateAccessToken|run\.|artifactregistry\.|cloudbuild\.|storage\.|firebase|firestore|billing|setOrgPolicy)' "$apply_permissions_file"; then
  echo "Forbidden HCP apply permission found" >&2
  exit 1
fi

if rg -n 'project-0d9658de-af29-4dc0-a99|production' "$apply_permissions_file"; then
  echo "Production reference found in HCP apply permission allowlist" >&2
  exit 1
fi

if rg -n 'roles/(owner|editor|run\.admin|artifactregistry\.writer|cloudbuild\.builds\.editor|iam\.serviceAccountTokenCreator|iam\.serviceAccountUser|storage\.admin)|google_service_account_key|principalSet://.*/workloadIdentityPools/github-preview-deploy/\*' "$root_dir" --glob '*.tf'; then
  echo "Broad deployment permission, static key, or wildcard federation found" >&2
  exit 1
fi

rg -q '^  workflow_dispatch:$' "$workflow_file"
rg -q '^  contents: read$' "$workflow_file"
rg -q '^  id-token: write$' "$workflow_file"
rg -q "github.repository == 'rentchaincanada/rentchain'" "$workflow_file"
rg -q "github.ref == 'refs/heads/main'" "$workflow_file"
rg -q "github.event_name == 'workflow_dispatch'" "$workflow_file"
rg -q 'workload_identity_provider: projects/501298948635/locations/global/workloadIdentityPools/github-preview-deploy/providers/github' "$workflow_file"
rg -q 'service_account: github-preview-deploy@rentchain-preview.iam.gserviceaccount.com' "$workflow_file"
rg -q 'gcloud projects describe rentchain-preview' "$workflow_file"

if rg -n '^  (push|pull_request|schedule):|gcloud (run|builds|artifacts|iam|projects add-iam-policy-binding)|docker (build|push)|terraform (apply|destroy)' "$workflow_file"; then
  echo "Untrusted trigger or mutation command found in B3 validation workflow" >&2
  exit 1
fi

echo "Preview foundation scope validation passed"
