#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOC="${ROOT}/docs/operations/production-release-control-founder-decisions.md"
CANDIDATE="${ROOT}/.github/workflows/production-candidate-deploy.yml"
PROMOTION="${ROOT}/.github/workflows/production-candidate-promote.yml"

pass=0
check() {
  local description="$1"
  shift
  if "$@"; then
    pass=$((pass + 1))
    printf 'ok %d - %s\n' "${pass}" "${description}"
  else
    printf 'not ok - %s\n' "${description}" >&2
    exit 1
  fi
}

contains() { grep -Fq -- "$2" "$1"; }
not_contains() { ! grep -Fq -- "$2" "$1"; }

check "candidate remains workflow_dispatch" contains "${CANDIDATE}" "workflow_dispatch:"
check "promotion remains workflow_dispatch" contains "${PROMOTION}" "workflow_dispatch:"
check "candidate environment is exact" contains "${CANDIDATE}" "environment: production-candidate"
check "promotion environment is exact" contains "${PROMOTION}" "environment: production-promotion"
check "candidate and promoter identities remain conceptually separate" bash -c \
  "grep -Fq 'rentchain-prod-candidate' '${DOC}' && grep -Fq 'rentchain-prod-promoter' '${DOC}'"
check "candidate deploys with no traffic" contains "${CANDIDATE}" "--no-traffic"
check "promotion requires candidate evidence" contains "${PROMOTION}" "Require successful candidate workflow run"
check "both paths document run.services.update" bash -c \
  "test \"\$(grep -o 'run.services.update' '${DOC}' | wc -l | tr -d ' ')\" -ge 2"
check "documentation rejects false IAM field separation" contains "${DOC}" \
  "does not provide field-level separation"
check "actAs absence is a pending-proof hypothesis" contains "${DOC}" \
  "absence of promoter \`actAs\` is a hypothesis pending runtime proof"
check "no static GCP credential is proposed" contains "${DOC}" \
  "No static GCP credential secret is proposed"
check "legacy deployer reuse is prohibited" contains "${DOC}" \
  "legacy Cloud Build deployer must not be reused"
check "Cloud Run Admin is not proposed" contains "${DOC}" \
  "No Cloud Run Admin, Owner, Editor, or project-wide Service Account User role is proposed"
check "Owner and Editor are not proposed" contains "${DOC}" \
  "No Cloud Run Admin, Owner, Editor, or project-wide Service Account User role is proposed"
check "project-wide Service Account User is not proposed" contains "${DOC}" \
  "No Cloud Run Admin, Owner, Editor, or project-wide Service Account User role is proposed"
check "test contains no live mutation tooling" bash -c \
  "! grep -Eq '(^|[[:space:]])(gcloud|gh|terraform)[[:space:]]' '$0'" "${BASH_SOURCE[0]}"
check "governed environments remain uncreated" contains "${DOC}" \
  "\`production-candidate\` and \`production-promotion\` were not created"
check "no Terraform resource is added" contains "${DOC}" "No Terraform resource was added"
check "protected PRs remain out of scope" contains "${DOC}" \
  "Production PR #1453 and PR #1435 remain out of scope"
check "four Founder decisions are explicitly enumerated" bash -c \
  "sed -n '/## Explicit Founder decisions required/,/## Boundaries/p' '${DOC}' | grep -Eq '^1\\.' && sed -n '/## Explicit Founder decisions required/,/## Boundaries/p' '${DOC}' | grep -Eq '^2\\.' && sed -n '/## Explicit Founder decisions required/,/## Boundaries/p' '${DOC}' | grep -Eq '^3\\.' && sed -n '/## Explicit Founder decisions required/,/## Boundaries/p' '${DOC}' | grep -Eq '^4\\.'"

test "${pass}" -eq 20
printf 'release-control decision guard passed (%d boundaries)\n' "${pass}"
