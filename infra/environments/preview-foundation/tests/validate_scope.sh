#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "$root_dir/../../.." && pwd)"
workflow_file="$repo_dir/.github/workflows/preview-deployment-identity-validation.yml"
dockerfile="$repo_dir/rentchain-api/Dockerfile"
dockerignore_file="$repo_dir/rentchain-api/.dockerignore"
apply_permissions_file="$root_dir/tests/hcp_apply_permissions.txt"
b4_apply_delta_file="$root_dir/tests/hcp_b4_apply_permission_delta.txt"
b7_plan_delta_file="$root_dir/tests/hcp_b7_plan_permission_delta.txt"
b7_apply_delta_file="$root_dir/tests/hcp_b7_apply_permission_delta.txt"

expected_resources="$(cat <<'EOF'
google_apikeys_key
google_artifact_registry_repository
google_artifact_registry_repository_iam_member
google_cloud_run_v2_service
google_cloud_run_v2_service_iam_member
google_firebase_project
google_firestore_database
google_iam_workload_identity_pool
google_iam_workload_identity_pool_provider
google_identity_platform_config
google_project_iam_custom_role
google_project_iam_member
google_project_service
google_secret_manager_secret
google_secret_manager_secret_iam_member
google_secret_manager_secret_version
google_service_account
google_service_account_iam_member
EOF
)"
actual_resources="$(rg -No 'resource "[^"]+"' "$root_dir" --glob '*.tf' | sed -E 's/.*resource "([^"]+)"/\1/' | sort -u)"
test "$actual_resources" = "$expected_resources"

test "$(rg -No '^resource "[^"]+"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "42"

test "$(rg -No 'service\s*=\s*"[^"]+\.googleapis\.com"' "$root_dir/services.tf" | wc -l | tr -d ' ')" = "0"
test "$(rg -No '"(apikeys|artifactregistry|cloudresourcemanager|firestore|iam|identitytoolkit|run|secretmanager|serviceusage)\.googleapis\.com"' "$root_dir/services.tf" | sort -u | wc -l | tr -d ' ')" = "9"

rg -q 'organization = "Rentchain"' "$root_dir/versions.tf"
rg -q 'name = "rentchain-preview-foundation"' "$root_dir/versions.tf"
rg -q 'var\.project_id == "rentchain-preview"' "$root_dir/variables.tf"
rg -q 'var\.project_number == "501298948635"' "$root_dir/variables.tf"
rg -q 'var\.environment == "preview"' "$root_dir/variables.tf"
rg -q 'var\.project_id != "project-0d9658de-af29-4dc0-a99"' "$root_dir/variables.tf"
rg -q 'variable "enable_preview_backend_service"' "$root_dir/variables.tf"
rg -q 'default     = true' "$root_dir/variables.tf"
rg -q 'variable "b7_foundation_phase"' "$root_dir/variables.tf"
rg -U -q 'variable "b7_foundation_phase" \{\n  description = "[^"]+"\n  type        = number\n  default     = 2' "$root_dir/variables.tf"
grep -Fq 'condition     = contains([1, 2, 3], var.b7_foundation_phase)' "$root_dir/variables.tf"
rg -U -q 'variable "b7_phase2_recovery_stage" \{\n  description = "[^"]+"\n  type        = number\n  default     = 2' "$root_dir/variables.tf"
grep -Fq 'condition     = contains([1, 2], var.b7_phase2_recovery_stage)' "$root_dir/variables.tf"
rg -U -q 'variable "b7_identity_platform_initialization" \{\n  description = "Governed stage activation for initializing Preview Identity Platform\."\n  type        = bool\n  default     = true\n\}' "$root_dir/variables.tf"
rg -U -q 'variable "b7_restricted_api_key_activation" \{\n  description = "Governed activation for the Terraform-managed restricted Preview backend API key and write-only Secret Manager delivery\."\n  type        = bool\n  default     = true\n\}' "$root_dir/variables.tf"
rg -U -q 'google-beta = \{\n      source  = "hashicorp/google-beta"\n      version = "6\.50\.0"\n    \}' "$root_dir/versions.tf"
rg -U -q 'provider "google-beta" \{\n  project               = var\.project_id\n  user_project_override = true\n\}' "$root_dir/providers.tf"
rg -U -q 'resource "google_firebase_project" "preview" \{\n  provider = google-beta\n  project  = var\.project_id\n\n  lifecycle \{\n    prevent_destroy = true\n  \}\n\}' "$root_dir/firebase.tf"
rg -U -q 'import \{\n  to = google_firebase_project\.preview\n  id = "rentchain-preview"\n\}' "$root_dir/imports.tf"
test "$(rg -No '^import \{' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "1"
test "$(rg -No 'provider = google-beta' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "1"
test "$(rg -No '^resource "google_firebase_project"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "1"
if rg -n 'google_firebase_(web|android|apple)_app|google_firebase_hosting|google_firebase_app_hosting|google_firebase_extensions|google_firebase_database' "$root_dir" --glob '*.tf'; then
  echo "Firebase ownership scope includes an app, Hosting, extension, or database resource" >&2
  exit 1
fi
rg -q 'count    = var\.enable_preview_backend_service \? 1 : 0' "$root_dir/cloud_run.tf"
rg -U -q 'lifecycle \{\n    prevent_destroy = true\n    ignore_changes = \[\n      scaling,\n    \]\n  \}' "$root_dir/cloud_run.tf"
test "$(rg -No 'ignore_changes' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "1"
rg -U -q 'scaling \{\n      min_instance_count = 0\n      max_instance_count = 1\n    \}' "$root_dir/cloud_run.tf"

if rg -n 'credentials\s*=|credentials_file|GOOGLE_APPLICATION_CREDENTIALS|service_account_key|private_key' "$root_dir" --glob '*.tf'; then
  echo "Static credential reference found" >&2
  exit 1
fi

if rg -n 'allUsers|allAuthenticatedUsers|google_storage_bucket|google_firestore_(document|field|index)|google_compute|google_container|google_cloudbuild' "$root_dir" --glob '*.tf'; then
  echo "Public IAM or workload resource found" >&2
  exit 1
fi

vercel_identity_file="$root_dir/vercel_preview_identity.tf"
test "$(rg -No '^resource "' "$vercel_identity_file" | wc -l | tr -d ' ')" = "6"
test "$(rg -No '^resource "google_iam_workload_identity_pool" "vercel_preview_proxy"' "$vercel_identity_file" | wc -l | tr -d ' ')" = "1"
test "$(rg -No '^resource "google_iam_workload_identity_pool_provider" "vercel_preview"' "$vercel_identity_file" | wc -l | tr -d ' ')" = "1"
test "$(rg -No '^resource "google_service_account" "vercel_preview_proxy"' "$vercel_identity_file" | wc -l | tr -d ' ')" = "1"
test "$(rg -No '^resource "google_service_account_iam_member" "vercel_preview_proxy_(workload_identity_user|openid_token_creator)"' "$vercel_identity_file" | wc -l | tr -d ' ')" = "2"
test "$(rg -No '^resource "google_cloud_run_v2_service_iam_member" "vercel_preview_proxy_invoker"' "$vercel_identity_file" | wc -l | tr -d ' ')" = "1"

rg -q 'workload_identity_pool_id = "vercel-preview-proxy"' "$vercel_identity_file"
rg -q 'workload_identity_pool_provider_id = "vercel-preview"' "$vercel_identity_file"
rg -q 'vercel_preview_issuer[[:space:]]*=[[:space:]]*"https://oidc\.vercel\.com/rent-chain"' "$vercel_identity_file"
test "$(rg -No 'allowed_audiences' "$vercel_identity_file" | wc -l | tr -d ' ')" = "0"
test "$(rg -No 'google_service_account_iam_member\.vercel_preview_proxy_(workload_identity_user|openid_token_creator)\.service_account_id' "$root_dir/checks.tf" | wc -l | tr -d ' ')" = "0"
rg -q '"google\.subject"        = "assertion\.sub"' "$vercel_identity_file"
rg -q '"attribute\.owner_id"    = "assertion\.owner_id"' "$vercel_identity_file"
rg -q '"attribute\.project_id"  = "assertion\.project_id"' "$vercel_identity_file"
rg -q '"attribute\.environment" = "assertion\.environment"' "$vercel_identity_file"
rg -q 'vercel_preview_owner_id[[:space:]]*=[[:space:]]*"team_NMg7i76JKz4ZwSJ07GYmZZYx"' "$vercel_identity_file"
rg -q 'vercel_preview_project_id[[:space:]]*=[[:space:]]*"prj_YN5ecHjXdwE3cp76pivyAf2BKX5I"' "$vercel_identity_file"
grep -Fq "assertion.owner_id == '\${local.vercel_preview_owner_id}'" "$vercel_identity_file"
grep -Fq "assertion.project_id == '\${local.vercel_preview_project_id}'" "$vercel_identity_file"
rg -q 'assertion\.environment ==.*preview' "$vercel_identity_file"
rg -q 'vercel_preview_subject[[:space:]]*=[[:space:]]*"owner:rent-chain:project:rentchain:environment:preview"' "$vercel_identity_file"
grep -Fq "assertion.sub == '\${local.vercel_preview_subject}'" "$vercel_identity_file"
grep -Fq 'principal://iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/vercel-preview-proxy/subject/${local.vercel_preview_subject}' "$vercel_identity_file"
rg -q 'role               = "roles/iam\.workloadIdentityUser"' "$vercel_identity_file"
rg -q 'role               = "roles/iam\.serviceAccountOpenIdTokenCreator"' "$vercel_identity_file"
rg -q 'role     = "roles/run\.invoker"' "$vercel_identity_file"
rg -q 'member   = google_service_account\.vercel_preview_proxy\.member' "$vercel_identity_file"

if rg -n 'principalSet://|roles/iam\.(serviceAccountTokenCreator|serviceAccountUser)|google_service_account_key|google_project_iam_(member|binding)|allUsers|allAuthenticatedUsers|project-0d9658de-af29-4dc0-a99' "$vercel_identity_file"; then
  echo "Broad federation, token, project IAM, public, static-key, or production scope found in Vercel Preview identity" >&2
  exit 1
fi

rg -q 'name        = local\.preview_firestore_database_id' "$root_dir/datastore_auth.tf"
rg -q 'preview_firestore_database_id = "\(default\)"' "$root_dir/datastore_auth.tf"
rg -q 'preview_firestore_location    = "northamerica-northeast1"' "$root_dir/datastore_auth.tf"
rg -q 'type        = "FIRESTORE_NATIVE"' "$root_dir/datastore_auth.tf"
rg -q 'delete_protection_state = "DELETE_PROTECTION_ENABLED"' "$root_dir/datastore_auth.tf"
rg -q 'deletion_policy         = "ABANDON"' "$root_dir/datastore_auth.tf"
rg -q 'role_id     = "previewBackendFirestoreRuntime"' "$root_dir/datastore_auth.tf"
grep -Fq "resource.name == 'projects/\${var.project_id}/databases/\${local.preview_firestore_database_id}'" "$root_dir/datastore_auth.tf"

expected_runtime_firestore_permissions="$(cat <<'EOF'
datastore.databases.get
datastore.entities.create
datastore.entities.delete
datastore.entities.get
datastore.entities.list
datastore.entities.update
EOF
)"
actual_runtime_firestore_permissions="$(
  sed -n '/preview_runtime_firestore_permissions = toset(/,/])/p' "$root_dir/datastore_auth.tf" \
    | rg -No '"[^"]+"' \
    | tr -d '"' \
    | sort -u
)"
test "$actual_runtime_firestore_permissions" = "$expected_runtime_firestore_permissions"

rg -q 'resource "google_identity_platform_config" "preview"' "$root_dir/datastore_auth.tf"
grep -Fq 'authorized_domains = sort(tolist(local.preview_identity_authorized_domains))' "$root_dir/datastore_auth.tf"
rg -q 'preview_identity_authorized_domains = toset' "$root_dir/datastore_auth.tf"
test "$(sed -n '/preview_identity_authorized_domains = toset(/,/])/p' "$root_dir/datastore_auth.tf" | rg -No '"[^"]+"' | tr -d '"')" = "localhost"
rg -q 'disabled_user_signup   = false' "$root_dir/datastore_auth.tf"
rg -q 'disabled_user_deletion = true' "$root_dir/datastore_auth.tf"
rg -U -q 'multi_tenant \{\n    allow_tenants           = false\n    default_tenant_location = ""\n  \}' "$root_dir/datastore_auth.tf"
test "$(rg -No 'multi_tenant \{' "$root_dir/datastore_auth.tf" | wc -l | tr -d ' ')" = "1"
rg -q 'role_id     = "previewBackendAuthReader"' "$root_dir/datastore_auth.tf"
test "$(sed -n '/preview_runtime_auth_permissions = toset(/,/])/p' "$root_dir/datastore_auth.tf" | rg -No '"[^"]+"' | tr -d '"')" = "firebaseauth.users.get"
rg -q 'service = "identitytoolkit.googleapis.com"' "$root_dir/datastore_auth.tf"
rg -q 'name         = "preview-backend-auth"' "$root_dir/datastore_auth.tf"
rg -q 'display_name = "Preview Backend Identity Toolkit"' "$root_dir/datastore_auth.tf"
rg -U -q '(?s)resource "google_apikeys_key" "preview_backend_auth" \{.*lifecycle \{\n    prevent_destroy = true\n  \}' "$root_dir/datastore_auth.tf"

if rg -n 'firebaseauth\.users\.(create|delete|update|sendEmail)|datastore\.(databases\.(delete|update)|indexes\.|operations\.)|roles/(datastore|firebase|identityplatform)' "$root_dir/datastore_auth.tf"; then
  echo "B7 runtime IAM broadening or destructive datastore permission found" >&2
  exit 1
fi

rg -U -q 'name  = "FIRESTORE_ENABLED"\n        value = "false"' "$root_dir/cloud_run.tf"
test "$(rg -No 'name = "FIREBASE_API_KEY"' "$root_dir/cloud_run.tf" | wc -l | tr -d ' ')" = "1"
rg -U -q 'env \{\n        name = "FIREBASE_API_KEY"\n\n        value_source \{\n          secret_key_ref \{\n            secret  = google_secret_manager_secret\.preview_backend_identity_toolkit\[0\]\.secret_id\n            version = "1"\n          \}\n        \}\n      \}' "$root_dir/cloud_run.tf"
grep -Fq 'google_secret_manager_secret_iam_member.preview_backend_identity_toolkit_accessor,' "$root_dir/cloud_run.tf"
if rg -n 'FIRESTORE_DATABASE_ID|PREVIEW_AUTH_ENABLED|FIREBASE_PROJECT_ID|google_apikeys_key|key_string|version\s*=\s*"latest"' "$root_dir/cloud_run.tf"; then
  echo "B7 Cloud Run secret injection contains a prohibited activation field, direct key reference, or mutable secret version" >&2
  exit 1
fi
if rg -U -n 'name = "FIREBASE_API_KEY"\n[[:space:]]+value[[:space:]]*=' "$root_dir/cloud_run.tf"; then
  echo "B7 Cloud Run FIREBASE_API_KEY must not use a literal value" >&2
  exit 1
fi

test "$(rg -No 'count = var\.b7_foundation_phase >= 2 \? 1 : 0' "$root_dir/datastore_auth.tf" | wc -l | tr -d ' ')" = "1"
test "$(rg -No 'count = var\.b7_foundation_phase >= 2 && var\.b7_phase2_recovery_stage >= 2 && var\.b7_identity_platform_initialization \? 1 : 0' "$root_dir/datastore_auth.tf" | wc -l | tr -d ' ')" = "1"
test "$(rg -No 'count = var\.b7_foundation_phase >= 2 && var\.b7_phase2_recovery_stage >= 2 && var\.b7_restricted_api_key_activation \? 1 : 0' "$root_dir/datastore_auth.tf" | wc -l | tr -d ' ')" = "1"
test "$(rg -No 'count = var\.b7_foundation_phase >= 2 && var\.b7_phase2_recovery_stage >= 2 && var\.b7_restricted_api_key_activation \? 1 : 0' "$root_dir/secret_manager.tf" | wc -l | tr -d ' ')" = "3"
grep -Fq 'value = var.b7_foundation_phase >= 2 && var.b7_phase2_recovery_stage >= 2 && var.b7_identity_platform_initialization ? {' "$root_dir/outputs.tf"
rg -U -q '(?s)resource "google_identity_platform_config" "preview" \{.*depends_on = \[\n    google_firebase_project\.preview,\n    google_project_service\.approved_management\["identitytoolkit\.googleapis\.com"\],\n  \]' "$root_dir/datastore_auth.tf"
if rg -n 'b7_identity_platform_initialization|b7_restricted_api_key_activation' "$root_dir/cloud_run.tf" "$root_dir/iam.tf"; then
  echo "The B7 authentication activation gates must not control Cloud Run or IAM" >&2
  exit 1
fi
test "$(rg -No 'count = var\.b7_foundation_phase >= 3 \? 1 : 0' "$root_dir/datastore_auth.tf" | wc -l | tr -d ' ')" = "4"

test "$(rg -No '^resource "google_artifact_registry_repository"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "1"
rg -q 'project       = var\.project_id' "$root_dir/deployment_foundation.tf"
rg -q 'preview_deployment_region = "northamerica-northeast1"' "$root_dir/deployment_foundation.tf"
rg -q 'preview_repository_id     = "rentchain-preview"' "$root_dir/deployment_foundation.tf"
rg -q 'preview_repository_format = "DOCKER"' "$root_dir/deployment_foundation.tf"
rg -q 'immutable_tags = true' "$root_dir/deployment_foundation.tf"
rg -q 'keep_recent_tagged_count = 15' "$root_dir/deployment_foundation.tf"
rg -q 'delete_untagged_after    = "604800s"' "$root_dir/deployment_foundation.tf"
rg -q 'account_id   = "preview-backend-runtime"' "$root_dir/deployment_foundation.tf"

rg -q 'role_id     = "terraformPreviewArtifactReader"' "$root_dir/image_delivery.tf"
rg -q 'artifactregistry\.repositories\.downloadArtifacts' "$root_dir/image_delivery.tf"
rg -q 'resource "google_artifact_registry_repository_iam_member" "terraform_preview_artifact_reader"' "$root_dir/image_delivery.tf"
rg -q 'terraform_preview_artifact_reader_member = "serviceAccount:hcp-terraform-preview-apply@rentchain-preview\.iam\.gserviceaccount\.com"' "$root_dir/image_delivery.tf"
if rg -n 'artifactregistry\.(repositories\.(uploadArtifacts|create|delete|setIamPolicy)|tags\.(create|delete|update))' "$root_dir/image_delivery.tf" | rg 'terraformPreviewArtifactReader|terraform_preview_artifact_reader'; then
  echo "Terraform Preview artifact reader has write permissions" >&2
  exit 1
fi

rg -q 'role               = "roles/iam\.serviceAccountUser"' "$root_dir/iam.tf"
rg -q 'service_account_id = google_service_account\.preview_backend_runtime\.name' "$root_dir/iam.tf"
rg -q 'member             = local\.hcp_terraform_apply_member' "$root_dir/iam.tf"

rg -q 'role_id     = "hcpTerraformPreviewB7Reader"' "$root_dir/iam.tf"
rg -q 'resource "google_project_iam_member" "hcp_terraform_preview_b7_reader"' "$root_dir/iam.tf"
rg -q 'member  = local\.hcp_terraform_plan_member' "$root_dir/iam.tf"
expected_b7_reader_permissions="$(cat <<'EOF'
apikeys.keys.get
apikeys.keys.getKeyString
datastore.databases.getMetadata
firebase.projects.get
firebaseauth.configs.get
iam.serviceAccounts.get
iam.serviceAccounts.getIamPolicy
iam.workloadIdentityPoolProviders.get
iam.workloadIdentityPools.get
secretmanager.secrets.get
secretmanager.secrets.getIamPolicy
secretmanager.versions.get
serviceusage.services.use
EOF
)"
actual_b7_reader_permissions="$(
  sed -n '/hcp_terraform_preview_b7_reader_permissions = toset(/,/])/p' "$root_dir/iam.tf" \
    | rg -No '"[^"]+"' \
    | tr -d '"' \
    | sort -u
)"
test "$actual_b7_reader_permissions" = "$expected_b7_reader_permissions"

rg -q 'role_id     = "terraformPreviewB7Manager"' "$root_dir/iam.tf"
rg -q 'resource "google_project_iam_member" "terraform_preview_b7_manager"' "$root_dir/iam.tf"
rg -q 'member  = local\.hcp_terraform_apply_member' "$root_dir/iam.tf"
expected_b7_manager_base_permissions="$(cat <<'EOF'
apikeys.keys.create
apikeys.keys.get
apikeys.keys.getKeyString
datastore.databases.create
datastore.databases.getMetadata
firebase.projects.get
firebaseauth.configs.create
firebaseauth.configs.get
firebaseauth.configs.update
secretmanager.secrets.create
secretmanager.secrets.get
secretmanager.secrets.getIamPolicy
secretmanager.secrets.setIamPolicy
secretmanager.versions.add
secretmanager.versions.get
serviceusage.services.use
EOF
)"
actual_b7_manager_base_permissions="$(
  sed -n '/terraform_preview_b7_manager_base_permissions = toset(/,/])/p' "$root_dir/iam.tf" \
    | rg -No '"[^"]+"' \
    | tr -d '"' \
    | sort -u
)"
test "$actual_b7_manager_base_permissions" = "$expected_b7_manager_base_permissions"
grep -Fq 'var.b7_phase2_recovery_stage >= 2 ? toset(["firebase.projects.update"]) : toset([])' "$root_dir/iam.tf"

rg -q 'role_id     = "terraformPreviewCustomRoleUpdater"' "$root_dir/iam.tf"
test "$(sed -n '/terraform_preview_custom_role_updater_permissions = toset(/,/])/p' "$root_dir/iam.tf" | rg -No '"[^"]+"' | tr -d '"')" = "iam.roles.update"
rg -q 'resource "google_project_iam_member" "terraform_preview_custom_role_updater"' "$root_dir/iam.tf"
rg -q 'member  = local\.hcp_terraform_apply_member' "$root_dir/iam.tf"
test "$(rg -No '^resource "google_project_iam_custom_role" "(hcp_terraform_preview_b7_reader|terraform_preview_b7_manager|terraform_preview_custom_role_updater)"' "$root_dir/iam.tf" | wc -l | tr -d ' ')" = "3"
test "$(rg -No '^resource "google_project_iam_member" "(hcp_terraform_preview_b7_reader|terraform_preview_b7_manager|terraform_preview_custom_role_updater)"' "$root_dir/iam.tf" | wc -l | tr -d ' ')" = "3"
if sed -n '/resource "google_project_iam_custom_role" "hcp_terraform_preview_b7_reader"/,/^}/p; /resource "google_project_iam_member" "hcp_terraform_preview_b7_reader"/,/^}/p; /resource "google_project_iam_custom_role" "terraform_preview_b7_manager"/,/^}/p; /resource "google_project_iam_member" "terraform_preview_b7_manager"/,/^}/p' "$root_dir/iam.tf" | rg -n 'count\s*=|for_each\s*='; then
  echo "B7 bootstrap IAM resources must remain ungated in Phase 1" >&2
  exit 1
fi

if printf '%s\n%s\n%s\n' "$actual_b7_reader_permissions" "$actual_b7_manager_base_permissions" "iam.roles.update" | rg -n '(delete|users\.|token|run\.|storage\.|billing|secretmanager\.versions\.(access|disable|destroy|list)|secretmanager\.secrets\.(delete|list)|firebase\.projects\.delete|identitytoolkit\.)'; then
  echo "Forbidden permission found in B7 HCP bootstrap roles" >&2
  exit 1
fi

test "$(rg -No 'roles/secretmanager\.[A-Za-z]+' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "2"
if rg -n 'roles/secretmanager\.' "$root_dir" --glob '*.tf' | rg -v '(secret_manager|checks)\.tf:.*roles/secretmanager\.secretAccessor'; then
  echo "Secret Manager predefined role found outside the exact secret-level runtime accessor" >&2
  exit 1
fi

test "$(rg -No '^resource "google_secret_manager_secret"' "$root_dir/secret_manager.tf" | wc -l | tr -d ' ')" = "1"
test "$(rg -No '^resource "google_secret_manager_secret_iam_member"' "$root_dir/secret_manager.tf" | wc -l | tr -d ' ')" = "1"
test "$(rg -No '^resource "google_secret_manager_secret_version"' "$root_dir/secret_manager.tf" | wc -l | tr -d ' ')" = "1"
rg -q 'secret_id = "preview-backend-identity-toolkit-api-key"' "$root_dir/secret_manager.tf"
rg -U -q 'replication \{\n    auto \{\}\n  \}' "$root_dir/secret_manager.tf"
rg -q 'deletion_protection = true' "$root_dir/secret_manager.tf"
rg -U -q '(?s)resource "google_secret_manager_secret" "preview_backend_identity_toolkit" \{.*lifecycle \{\n    prevent_destroy = true\n  \}' "$root_dir/secret_manager.tf"
grep -Fq 'secret_data_wo         = google_apikeys_key.preview_backend_auth[0].key_string' "$root_dir/secret_manager.tf"
rg -q 'secret_data_wo_version = 1' "$root_dir/secret_manager.tf"
rg -q 'deletion_policy        = "DISABLE"' "$root_dir/secret_manager.tf"
rg -U -q '(?s)resource "google_secret_manager_secret_version" "preview_backend_identity_toolkit" \{.*lifecycle \{\n    create_before_destroy = true\n  \}' "$root_dir/secret_manager.tf"
rg -U -q 'resource "google_secret_manager_secret_iam_member" "preview_backend_identity_toolkit_accessor" \{\n  count = var\.b7_foundation_phase >= 2 && var\.b7_phase2_recovery_stage >= 2 && var\.b7_restricted_api_key_activation \? 1 : 0\n\n  project   = var\.project_id\n  secret_id = google_secret_manager_secret\.preview_backend_identity_toolkit\[0\]\.secret_id\n  role      = "roles/secretmanager\.secretAccessor"\n  member    = google_service_account\.preview_backend_runtime\.member\n\}' "$root_dir/secret_manager.tf"
grep -Fq 'google_secret_manager_secret_iam_member.preview_backend_identity_toolkit_accessor[0].secret_id == google_secret_manager_secret.preview_backend_identity_toolkit[0].id' "$root_dir/checks.tf"
test "$(rg -No 'secret_data_wo\s*=' "$root_dir/secret_manager.tf" | wc -l | tr -d ' ')" = "1"
if rg -n '(^|[[:space:]])secret_data[[:space:]]*=' "$root_dir" --glob '*.tf'; then
  echo "Ordinary Secret Manager secret_data found; write-only delivery is required" >&2
  exit 1
fi
if rg -n 'google_project_iam_(member|binding).*secretmanager' "$root_dir" --glob '*.tf'; then
  echo "Project-wide Secret Manager IAM found" >&2
  exit 1
fi
if rg -n 'FIREBASE_API_KEY' "$root_dir" --glob '*.tf' | rg -v '/(cloud_run|checks)\.tf:'; then
  echo "FIREBASE_API_KEY found outside the governed Cloud Run resource or its check" >&2
  exit 1
fi

if rg -n 'roles/serviceusage\.serviceUsageConsumer' "$root_dir" --glob '*.tf'; then
  echo "Predefined Service Usage role found in Preview foundation" >&2
  exit 1
fi

rg -q 'role_id     = "hcpTerraformPreviewCloudRunViewer"' "$root_dir/iam.tf"
rg -q 'terraform_preview_cloud_run_viewer_permissions = toset' "$root_dir/iam.tf"
rg -q '"run\.services\.get"' "$root_dir/iam.tf"
rg -q 'resource "google_project_iam_member" "terraform_preview_cloud_run_viewer"' "$root_dir/iam.tf"
rg -q 'member  = local\.hcp_terraform_plan_member' "$root_dir/iam.tf"
rg -q 'hcp_terraform_plan_member  = "serviceAccount:hcp-terraform-preview@rentchain-preview\.iam\.gserviceaccount\.com"' "$root_dir/iam.tf"
actual_cloud_run_viewer_permissions="$(
  sed -n '/terraform_preview_cloud_run_viewer_permissions = toset(/,/])/p' "$root_dir/iam.tf" \
    | rg -No '"[^"]+"' \
    | tr -d '"'
)"
expected_cloud_run_viewer_permissions="$(cat <<'EOF'
run.services.get
run.services.getIamPolicy
EOF
)"
test "$actual_cloud_run_viewer_permissions" = "$expected_cloud_run_viewer_permissions"

if rg -n 'roles/iam\.serviceAccountUser' "$root_dir" --glob '*.tf' | rg -v '/(iam|checks)\.tf:'; then
  echo "Service Account User must remain limited to the B6 exact runtime binding" >&2
  exit 1
fi

expected_image_publisher_permissions="$(cat <<'EOF'
artifactregistry.dockerimages.get
artifactregistry.repositories.downloadArtifacts
artifactregistry.repositories.get
artifactregistry.repositories.uploadArtifacts
artifactregistry.tags.create
artifactregistry.tags.get
EOF
)"
actual_image_publisher_permissions="$(
  rg -No '"artifactregistry\.[^"]+"' "$root_dir/image_delivery.tf" \
    | tr -d '"' \
    | sort -u
)"
test "$actual_image_publisher_permissions" = "$expected_image_publisher_permissions"
test "$(printf '%s\n' "$actual_image_publisher_permissions" | wc -l | tr -d ' ')" = "6"

rg -q 'role_id     = "githubPreviewImagePublisher"' "$root_dir/image_delivery.tf"
rg -q 'resource "google_artifact_registry_repository_iam_member" "github_preview_image_publisher"' "$root_dir/image_delivery.tf"
rg -q 'repository = google_artifact_registry_repository\.preview_backend\.repository_id' "$root_dir/image_delivery.tf"
rg -q 'github_preview_image_publisher_member = "serviceAccount:github-preview-deploy@rentchain-preview\.iam\.gserviceaccount\.com"' "$root_dir/image_delivery.tf"
rg -q 'member     = local\.github_preview_image_publisher_member' "$root_dir/image_delivery.tf"
rg -q 'role       = google_project_iam_custom_role\.github_preview_image_publisher\.name' "$root_dir/image_delivery.tf"

if rg -n 'artifactregistry\.repositories\.(create|update|delete|getIamPolicy|setIamPolicy|list)|artifactregistry\.(packages|versions|files)\.delete|artifactregistry\.tags\.(delete|update)|iam\.serviceAccounts\.actAs|roles/artifactregistry\.' "$root_dir/image_delivery.tf"; then
  echo "Forbidden B5 image-publisher permission or predefined role found" >&2
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

expected_b7_plan_delta="$(cat <<'EOF'
apikeys.keys.get
apikeys.keys.getKeyString
datastore.databases.getMetadata
firebase.projects.get
firebaseauth.configs.get
iam.serviceAccounts.get
iam.serviceAccounts.getIamPolicy
iam.workloadIdentityPoolProviders.get
iam.workloadIdentityPools.get
secretmanager.secrets.get
secretmanager.secrets.getIamPolicy
secretmanager.versions.get
serviceusage.services.use
EOF
)"
test "$(sort -u "$b7_plan_delta_file")" = "$expected_b7_plan_delta"
test "$(wc -l < "$b7_plan_delta_file" | tr -d ' ')" = "13"

expected_b7_apply_delta="$(cat <<'EOF'
apikeys.keys.create
apikeys.keys.get
apikeys.keys.getKeyString
datastore.databases.create
datastore.databases.getMetadata
firebase.projects.get
firebase.projects.update
firebaseauth.configs.create
firebaseauth.configs.get
firebaseauth.configs.update
secretmanager.secrets.create
secretmanager.secrets.get
secretmanager.secrets.getIamPolicy
secretmanager.secrets.setIamPolicy
secretmanager.versions.add
secretmanager.versions.get
serviceusage.services.use
EOF
)"
test "$(sort -u "$b7_apply_delta_file")" = "$expected_b7_apply_delta"
test "$(wc -l < "$b7_apply_delta_file" | tr -d ' ')" = "17"

if rg -n '(delete|undelete|users\.(create|delete|update|sendEmail)|getSecret|getHashConfig|serviceAccountKeys|signBlob|signJwt|getAccessToken|generateAccessToken|run\.|storage\.|billing|secretmanager\.versions\.(access|disable|destroy|list)|secretmanager\.secrets\.(delete|list))' "$b7_plan_delta_file" "$b7_apply_delta_file"; then
  echo "Forbidden B7 HCP permission delta found" >&2
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

if rg -n 'roles/(owner|editor|run\.admin|artifactregistry\.writer|cloudbuild\.builds\.editor|iam\.serviceAccountTokenCreator|storage\.admin)|google_service_account_key|principalSet://.*/workloadIdentityPools/github-preview-deploy/\*' "$root_dir" --glob '*.tf'; then
  echo "Broad deployment permission, static key, or wildcard federation found" >&2
  exit 1
fi

expected_cloud_run_permissions="$(cat <<'EOF'
run.locations.get
run.operations.get
run.services.create
run.services.delete
run.services.get
run.services.getIamPolicy
run.services.setIamPolicy
run.services.update
EOF
)"
actual_cloud_run_permissions="$(rg -No '"run\.[^"]+"' "$root_dir/iam.tf" | tr -d '"' | sort -u)"
test "$actual_cloud_run_permissions" = "$expected_cloud_run_permissions"

rg -q '^  workflow_dispatch:$' "$workflow_file"
rg -q '^  contents: read$' "$workflow_file"
rg -q '^  id-token: write$' "$workflow_file"
test "$(rg -No '^  [a-z-]+: (read|write)$' "$workflow_file" | wc -l | tr -d ' ')" = "2"
rg -q 'source_sha:' "$workflow_file"
rg -q "github.repository == 'rentchaincanada/rentchain'" "$workflow_file"
rg -q "github.ref == 'refs/heads/main'" "$workflow_file"
rg -q "github.event_name == 'workflow_dispatch'" "$workflow_file"
grep -Fq '[[ "${SOURCE_SHA}" =~ ^[0-9a-f]{40}$ ]]' "$workflow_file"
grep -Fq 'test "${SOURCE_SHA}" = "${WORKFLOW_SHA}"' "$workflow_file"
rg -q 'persist-credentials: false' "$workflow_file"
grep -Fq 'git merge-base --is-ancestor "${SOURCE_SHA}" "${WORKFLOW_SHA}"' "$workflow_file"
grep -Fq 'git checkout --detach "${SOURCE_SHA}"' "$workflow_file"
rg -q 'workload_identity_provider: projects/501298948635/locations/global/workloadIdentityPools/github-preview-deploy/providers/github' "$workflow_file"
rg -q 'service_account: github-preview-deploy@rentchain-preview.iam.gserviceaccount.com' "$workflow_file"
rg -q 'northamerica-northeast1-docker.pkg.dev/rentchain-preview/rentchain-preview/backend' "$workflow_file"
grep -Fq 'image_tag="sha-${SOURCE_SHA}"' "$workflow_file"
rg -q -- '--platform linux/amd64' "$workflow_file"
rg -q -- '--load' "$workflow_file"
rg -q 'docker image inspect' "$workflow_file"
rg -q 'runtime_user=' "$workflow_file"
rg -q 'node dist/index\.build\.js' "$workflow_file"
rg -q '8080/tcp' "$workflow_file"
rg -q 'Prohibited embedded file paths' "$workflow_file"
rg -q 'High-confidence credential pattern categories detected in' "$workflow_file"
rg -q 'docker run --detach' "$workflow_file"
rg -q '/health/ready' "$workflow_file"
grep -Fq 'docker tag "${VALIDATION_IMAGE}" "${remote_image}"' "$workflow_file"
grep -Fq 'docker push "${remote_image}"' "$workflow_file"
test "$(rg -No 'uses: [^@]+@[0-9a-f]{40}' "$workflow_file" | wc -l | tr -d ' ')" = "4"

build_line="$(rg -n 'docker buildx build' "$workflow_file" | cut -d: -f1)"
inspect_line="$(rg -n -- '- name: Inspect image configuration and runtime contents' "$workflow_file" | cut -d: -f1)"
smoke_line="$(rg -n -- '- name: Smoke-test the validated image' "$workflow_file" | cut -d: -f1)"
auth_line="$(rg -n -- '- name: Authenticate to the isolated Preview project' "$workflow_file" | cut -d: -f1)"
push_line="$(rg -n 'docker push "\$\{remote_image\}"' "$workflow_file" | cut -d: -f1)"
test -n "$build_line"
test -n "$inspect_line"
test -n "$smoke_line"
test -n "$auth_line"
test -n "$push_line"
test "$build_line" -lt "$inspect_line"
test "$inspect_line" -lt "$smoke_line"
test "$smoke_line" -lt "$auth_line"
test "$build_line" -lt "$auth_line"
test "$auth_line" -lt "$push_line"

if rg -n -- '--push|docker buildx build.*--push' "$workflow_file"; then
  echo "Buildx must load locally and must not publish before validation" >&2
  exit 1
fi

if rg -n '^  (push|pull_request|pull_request_target|schedule):|gcloud (run|builds|iam|projects add-iam-policy-binding)|terraform (apply|destroy)|(^|:)latest($|[[:space:]])|:main($|[[:space:]])|:preview($|[[:space:]])|:stable($|[[:space:]])|:production($|[[:space:]])' "$workflow_file"; then
  echo "Untrusted trigger, prohibited command, or mutable image tag found in B5 workflow" >&2
  exit 1
fi

if rg -n 'credentials_json|service_account_key|private_key([[:space:]]*:|_data)|pull_request_target|contents: write|packages: write|deployments: write|security-events: write' "$workflow_file"; then
  echo "Static credential or excessive workflow permission found" >&2
  exit 1
fi

test "$(rg -No '^FROM node:20\.20\.2-slim AS (build|runtime)$' "$dockerfile" | wc -l | tr -d ' ')" = "2"
rg -q '^RUN npm ci$' "$dockerfile"
rg -q '^RUN npm ci --omit=dev && npm cache clean --force$' "$dockerfile"
rg -q '^COPY --from=build /app/dist ./dist$' "$dockerfile"
rg -q '^ENV NODE_ENV=production$' "$dockerfile"
rg -q '^ENV PORT=8080$' "$dockerfile"
rg -q '^EXPOSE 8080$' "$dockerfile"
rg -q '^USER node$' "$dockerfile"
rg -q '^CMD \["node", "dist/index\.build\.js"\]$' "$dockerfile"

if rg -n '^(ARG|ENV) .*(SECRET|TOKEN|PASSWORD|CREDENTIAL|PRODUCTION_PROJECT)' "$dockerfile"; then
  echo "Sensitive Docker build or runtime input found" >&2
  exit 1
fi

for ignored_path in \
  '.git' \
  '.github' \
  '.handoff' \
  '.env' \
  '.env.*' \
  'node_modules' \
  'dist' \
  'coverage' \
  'tests' \
  '**/__tests__' \
  'cloudbuild.yaml'; do
  grep -Fqx "$ignored_path" "$dockerignore_file"
done

echo "Preview foundation scope validation passed"
