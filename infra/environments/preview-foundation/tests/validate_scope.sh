#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "$root_dir/../../.." && pwd)"
workflow_file="$repo_dir/.github/workflows/preview-deployment-identity-validation.yml"
dockerfile="$repo_dir/rentchain-api/Dockerfile"
dockerignore_file="$repo_dir/rentchain-api/.dockerignore"
apply_permissions_file="$root_dir/tests/hcp_apply_permissions.txt"
b4_apply_delta_file="$root_dir/tests/hcp_b4_apply_permission_delta.txt"

expected_resources="$(cat <<'EOF'
google_artifact_registry_repository
google_artifact_registry_repository_iam_member
google_cloud_run_v2_service
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

test "$(rg -No '^resource "[^"]+"' "$root_dir" --glob '*.tf' | wc -l | tr -d ' ')" = "15"

test "$(rg -No 'service\s*=\s*"[^"]+\.googleapis\.com"' "$root_dir/services.tf" | wc -l | tr -d ' ')" = "0"
test "$(rg -No '"(artifactregistry|cloudresourcemanager|iam|run|serviceusage)\.googleapis\.com"' "$root_dir/services.tf" | sort -u | wc -l | tr -d ' ')" = "5"

rg -q 'organization = "Rentchain"' "$root_dir/versions.tf"
rg -q 'name = "rentchain-preview-foundation"' "$root_dir/versions.tf"
rg -q 'var\.project_id == "rentchain-preview"' "$root_dir/variables.tf"
rg -q 'var\.project_number == "501298948635"' "$root_dir/variables.tf"
rg -q 'var\.environment == "preview"' "$root_dir/variables.tf"
rg -q 'var\.project_id != "project-0d9658de-af29-4dc0-a99"' "$root_dir/variables.tf"
rg -q 'variable "enable_preview_backend_service"' "$root_dir/variables.tf"
rg -q 'default     = false' "$root_dir/variables.tf"
rg -q 'count    = var\.enable_preview_backend_service \? 1 : 0' "$root_dir/cloud_run.tf"

if rg -n 'credentials\s*=|credentials_file|GOOGLE_APPLICATION_CREDENTIALS|service_account_key|private_key' "$root_dir" --glob '*.tf'; then
  echo "Static credential reference found" >&2
  exit 1
fi

if rg -n 'allUsers|allAuthenticatedUsers|google_storage_bucket|google_firestore|google_compute|google_container|google_cloudbuild' "$root_dir" --glob '*.tf'; then
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

rg -q 'role               = "roles/iam\.serviceAccountUser"' "$root_dir/iam.tf"
rg -q 'service_account_id = google_service_account\.preview_backend_runtime\.name' "$root_dir/iam.tf"
rg -q 'member             = local\.hcp_terraform_apply_member' "$root_dir/iam.tf"

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
