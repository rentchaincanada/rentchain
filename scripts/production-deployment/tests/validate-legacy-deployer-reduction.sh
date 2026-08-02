#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
plan="${root}/docs/operations/production-cloudbuild-legacy-deployer-reduction.md"
builder="${root}/production_cloudbuild_identity.tf"
build="${root}/rentchain-api/cloudbuild.yaml"
workflows="${root}/.github/workflows"
legacy='rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com'

test -f "${plan}"
test -f "${builder}"
test -f "${build}"

# The repository must not manage, impersonate, or execute as the legacy account.
if rg -n "${legacy}" "${root}" --glob '*.tf' --glob '*.tfvars' --glob '*.yml' --glob '*.yaml' --glob '*.sh' --glob '!scripts/production-deployment/tests/validate-legacy-deployer-reduction.sh'; then
  echo 'Legacy deployer found in executable or Terraform configuration' >&2
  exit 1
fi

grep -Fq 'account_id   = "rentchain-cloudbuild-builder"' "${builder}"
grep -Fq 'no deploy or runtime authority' "${builder}"
if rg -n 'gcloud run|update-traffic|terraform apply|set-iam-policy|add-iam-policy-binding|remove-iam-policy-binding|secrets versions access' "${build}"; then
  echo 'Automatic build path contains governed mutation authority' >&2
  exit 1
fi

# Candidate and promotion workflows must remain identity-name indirections and
# must not silently fall back to the legacy account.
grep -Fq '${{ vars.PRODUCTION_DEPLOY_SERVICE_ACCOUNT }}' "${workflows}/production-candidate-deploy.yml"
grep -Fq '${{ vars.PRODUCTION_PROMOTION_SERVICE_ACCOUNT }}' "${workflows}/production-candidate-promote.yml"
test "$(rg -n "${legacy}" "${workflows}" | wc -l | tr -d ' ')" = '0'

# The external removal is explicit, complete, and preserves the account.
for role in \
  roles/artifactregistry.writer \
  roles/cloudbuild.builds.editor \
  roles/iam.serviceAccountUser \
  roles/logging.logWriter \
  roles/run.admin \
  roles/serviceusage.serviceUsageConsumer \
  roles/storage.admin; do
  test "$(grep -F -- "--role='${role}'" "${plan}" | wc -l | tr -d ' ')" = '1'
done
test "$(grep -F -- "--member='serviceAccount:${legacy}'" "${plan}" | wc -l | tr -d ' ')" = '7'
grep -Fq 'The service account remains enabled and undeleted' "${plan}"
grep -Fq 'must remain disabled' "${plan}"

for forbidden in \
  roles/owner \
  roles/editor \
  roles/resourcemanager.projectIamAdmin \
  roles/iam.securityAdmin \
  roles/secretmanager.admin \
  roles/secretmanager.secretAccessor; do
  if grep -Fq -- "--role='${forbidden}'" "${plan}"; then
    echo "Unexpected legacy role in removal plan: ${forbidden}" >&2
    exit 1
  fi
done

printf '%s\n' 'Legacy deployer reduction validation passed (20 boundaries).'
