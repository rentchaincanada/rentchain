#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflow="${repo_root}/.github/workflows/preview-deployment-identity-validation.yml"
validator="${repo_root}/scripts/preview-deployment/validate-pr-head-request.mjs"
dockerfile_policy="${repo_root}/scripts/preview-deployment/validate-backend-dockerfile-policy.mjs"
manifest_policy="${repo_root}/scripts/preview-deployment/validate-runtime-dependency-policy.mjs"
document="${repo_root}/docs/operations/preview-pr-head-image-publication.md"
fixtures="$(mktemp -d)"
trap 'rm -rf "${fixtures}"' EXIT

pass=0
check() {
  local description="$1"
  shift
  "$@"
  pass=$((pass + 1))
  printf 'ok %d - %s\n' "${pass}" "${description}"
}
contains() { grep -Fq -- "$2" "$1"; }
not_contains() { ! grep -Fq -- "$2" "$1"; }

head_sha="0822687bd0bbfb0708ed2baa8f1397fcd989b8e7"
base_sha="14d91a023c9f8f3765ae836c673ac3d86c17b5a5"
cat > "${fixtures}/valid.json" <<JSON
{"number":1453,"state":"open","base":{"ref":"main","sha":"${base_sha}","repo":{"full_name":"rentchaincanada/rentchain"}},"head":{"sha":"${head_sha}","repo":{"full_name":"rentchaincanada/rentchain","fork":false}}}
JSON

valid() {
  node "${validator}" "${fixtures}/valid.json" 1453 "${head_sha}" "${base_sha}" founder-pr1453-qa >/dev/null
}
invalid_with_jq() {
  local filter="$1"
  shift
  jq "${filter}" "${fixtures}/valid.json" > "${fixtures}/invalid.json"
  ! node "${validator}" "${fixtures}/invalid.json" "$@" >/dev/null 2>&1
}

check "workflow remains manual-only" bash -c "grep -Fq '  workflow_dispatch:' '${workflow}' && ! grep -Eq '^  (pull_request|push|schedule):' '${workflow}'"
check "permissions remain minimal" bash -c "grep -Fq '  contents: read' '${workflow}' && grep -Fq '  pull-requests: read' '${workflow}' && grep -Fq '  id-token: write' '${workflow}' && test \"\$(grep -Ec '^  [a-z-]+: (read|write)$' '${workflow}')\" = 3"
check "trusted repository and main ref are fixed" bash -c "grep -Fq \"github.repository == 'rentchaincanada/rentchain'\" '${workflow}' && grep -Fq \"github.ref == 'refs/heads/main'\" '${workflow}'"
check "all governed PR inputs exist" bash -c "grep -Fq 'pr_number:' '${workflow}' && grep -Fq 'expected_head_sha:' '${workflow}' && grep -Fq 'expected_base_sha:' '${workflow}' && grep -Fq 'authorization_reference:' '${workflow}'"
check "valid same-repository open PR passes" valid
check "wrong PR number fails" bash -c "! node '${validator}' '${fixtures}/valid.json' 1454 '${head_sha}' '${base_sha}' auth >/dev/null 2>&1"
check "wrong head SHA fails" bash -c "! node '${validator}' '${fixtures}/valid.json' 1453 '1822687bd0bbfb0708ed2baa8f1397fcd989b8e7' '${base_sha}' auth >/dev/null 2>&1"
check "short SHA fails" bash -c "! node '${validator}' '${fixtures}/valid.json' 1453 '0822687b' '${base_sha}' auth >/dev/null 2>&1"
check "uppercase SHA fails" bash -c "! node '${validator}' '${fixtures}/valid.json' 1453 '0822687BD0BBFB0708ED2BAA8F1397FCD989B8E7' '${base_sha}' auth >/dev/null 2>&1"
check "closed PR fails" invalid_with_jq '.state="closed"' 1453 "${head_sha}" "${base_sha}" auth
check "fork PR fails" invalid_with_jq '.head.repo={"full_name":"attacker/rentchain","fork":true}' 1453 "${head_sha}" "${base_sha}" auth
check "wrong base branch fails" invalid_with_jq '.base.ref="develop"' 1453 "${head_sha}" "${base_sha}" auth
check "moved head fails" invalid_with_jq '.head.sha="1822687bd0bbfb0708ed2baa8f1397fcd989b8e7"' 1453 "${head_sha}" "${base_sha}" auth
check "moved base fails" invalid_with_jq '.base.sha="24d91a023c9f8f3765ae836c673ac3d86c17b5a5"' 1453 "${head_sha}" "${base_sha}" auth
check "workflow source is trusted main" contains "${workflow}" 'test "${GITHUB_WORKFLOW_REF}" = "rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main"'
check "source checkout is detached at exact SHA" contains "${workflow}" 'git checkout --detach "${SOURCE_SHA}"'
check "Dockerfile uses trusted centralized policy" contains "${workflow}" 'node "${trusted_dockerfile_policy}" "${GITHUB_WORKSPACE}" "${WORKFLOW_SHA}" "${SOURCE_SHA}"'
check "Dockerfile validator is loaded from trusted main" contains "${workflow}" 'git show "${WORKFLOW_SHA}:scripts/preview-deployment/validate-backend-dockerfile-policy.mjs" > "${trusted_dockerfile_policy}"'
check "Dockerfile path remains fixed" contains "${dockerfile_policy}" 'const DOCKERFILE = "rentchain-api/Dockerfile"'
check "package files use trusted dependency validation" contains "${workflow}" 'node "${trusted_policy}" dependencies "${trusted_package}" "${trusted_lock}" rentchain-api/package.json rentchain-api/package-lock.json'
check "Node engine transition is exact and trusted" contains "${manifest_policy}" 'new Set([">=20 <21->>=24 <25"])'
check "engineStrict remains required" contains "${manifest_policy}" 'trusted.engineStrict !== true || candidate.engineStrict !== true'
check "lockfile root engines must match manifest" contains "${manifest_policy}" 'Lockfile root engines must match package.json'
check "unrelated lockfile root metadata remains protected" contains "${manifest_policy}" 'Unrelated lockfile root metadata may not differ from the trusted lockfile'
check "clean lockfile install runs before authentication" bash -c "test \"\$(grep -n 'npm ci --ignore-scripts --prefix rentchain-api' '${workflow}' | cut -d: -f1)\" -lt \"\$(grep -n 'Authenticate to the isolated Preview project' '${workflow}' | cut -d: -f1)\""
check "Sharp native runtime is validated" contains "${workflow}" 'const sharp = require("sharp");'
check "runtime dependency policy positive and negative tests pass" node "${repo_root}/scripts/preview-deployment/tests/validate-runtime-dependency-policy.mjs"
check "Dockerfile policy positive and negative tests pass" node "${repo_root}/scripts/preview-deployment/tests/validate-backend-dockerfile-policy.mjs"
check "Preview project is fixed" contains "${workflow}" 'PROJECT_ID: rentchain-preview'
check "Preview registry is fixed" contains "${workflow}" 'northamerica-northeast1-docker.pkg.dev/rentchain-preview/rentchain-preview/backend'
check "Production project is absent" not_contains "${workflow}" 'project-0d9658de-af29-4dc0-a99'
check "tag derives from PR and full SHA" contains "${workflow}" 'image_tag="pr-${PR_NUMBER}-sha-${SOURCE_SHA}"'
check "platform is linux/amd64" contains "${workflow}" '--platform linux/amd64'
check "image revision label binds exact source SHA" contains "${workflow}" '--label "org.opencontainers.image.revision=${SOURCE_SHA}"'
check "image source label binds trusted repository" contains "${workflow}" '--label "org.opencontainers.image.source=https://github.com/rentchaincanada/rentchain"'
check "workflow contains one build" bash -c "test \"\$(grep -c 'docker buildx build' '${workflow}')\" = 1"
check "workflow contains one push" bash -c "test \"\$(grep -c '^          docker push ' '${workflow}')\" = 1"
check "runtime validation precedes authentication" bash -c "test \"\$(grep -n 'Smoke-test the validated image' '${workflow}' | cut -d: -f1)\" -lt \"\$(grep -n 'Authenticate to the isolated Preview project' '${workflow}' | cut -d: -f1)\""
check "PR metadata is reverified immediately before authentication" contains "${workflow}" 'Reverify authorized PR immediately before Google authentication'
check "immutable digest is captured" contains "${workflow}" 'sha256:[0-9a-f]{64}'
check "full immutable reference is emitted" contains "${workflow}" 'immutable_reference=%s@%s'
check "no Cloud Run deployment" not_contains "${workflow}" 'gcloud run deploy'
check "no traffic mutation" not_contains "${workflow}" 'update-traffic'
check "no IAM mutation" not_contains "${workflow}" 'add-iam-policy-binding'
check "no Terraform apply" not_contains "${workflow}" 'terraform apply'
check "no PR-provided secrets" not_contains "${workflow}" 'secrets.'
check "no mutable latest tag" not_contains "${workflow}" ':latest'
check "existing main tag remains" contains "${workflow}" 'image_tag="sha-${SOURCE_SHA}"'
check "documentation records no-dispatch boundary" contains "${document}" 'does not authorize dispatch'

printf 'Preview PR-head image governance validation passed: %d/%d\n' "${pass}" "${pass}"
