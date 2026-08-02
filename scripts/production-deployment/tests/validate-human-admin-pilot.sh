#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
candidate="${root}/.github/workflows/production-candidate-deploy.yml"
promotion="${root}/.github/workflows/production-candidate-promote.yml"
candidate_script="${root}/scripts/production-deployment/prepare-human-candidate.sh"
promotion_script="${root}/scripts/production-deployment/prepare-human-promotion.sh"
runbook="${root}/docs/operations/production-human-admin-release-pilot.md"
decisions="${root}/docs/operations/production-release-control-founder-decisions.md"

pass=0
check() {
  local description="$1"
  shift
  "$@" || { printf 'not ok - %s\n' "${description}" >&2; exit 1; }
  pass=$((pass + 1))
  printf 'ok %d - %s\n' "${pass}" "${description}"
}
contains() { grep -Fq -- "$2" "$1"; }
not_contains() { ! grep -Fq -- "$2" "$1"; }

for file in "${candidate}" "${promotion}" "${candidate_script}" "${promotion_script}" "${runbook}" "${decisions}"; do
  test -f "${file}"
done

check "candidate workflow is manual" contains "${candidate}" "workflow_dispatch:"
check "promotion workflow is manual" contains "${promotion}" "workflow_dispatch:"
check "candidate has no environment binding" not_contains "${candidate}" "environment:"
check "promotion has no environment binding" not_contains "${promotion}" "environment:"
check "candidate has no OIDC permission" not_contains "${candidate}" "id-token: write"
check "promotion has no OIDC permission" not_contains "${promotion}" "id-token: write"
check "candidate has no Google auth action" not_contains "${candidate}" "google-github-actions/auth"
check "promotion has no Google auth action" not_contains "${promotion}" "google-github-actions/auth"
check "workflows read no Production WIF variable" bash -c "! grep -Fq 'PRODUCTION_WORKLOAD_IDENTITY_PROVIDER' '${candidate}' '${promotion}'"
check "workflows read no Production service-account variable" bash -c "! grep -Eq 'PRODUCTION_(DEPLOY|PROMOTION)_SERVICE_ACCOUNT' '${candidate}' '${promotion}'"
check "candidate workflow executes no Cloud Run deploy" not_contains "${candidate}" "gcloud run deploy"
check "promotion workflow executes no traffic update" not_contains "${promotion}" "update-traffic"
check "candidate script contains only an inert command string" contains "${candidate_script}" 'command_template="gcloud run deploy'
check "promotion script contains only inert command strings" contains "${promotion_script}" 'promotion_command="gcloud run services update-traffic'
check "candidate uploads evidence" contains "${candidate}" "production-candidate-request"
check "promotion requires candidate evidence" contains "${promotion}" "Require successful candidate preparation run"
check "candidate records no cloud mutation" contains "${candidate}" "NO CLOUD MUTATION PERFORMED"
check "promotion records no traffic mutation" contains "${promotion}" "NO TRAFFIC MUTATION PERFORMED"
check "scripts expose no apply mode" bash -c "! grep -Fq -- '--apply' '${candidate_script}' '${promotion_script}'"
check "scripts expose no execute mode" bash -c "! grep -Fq -- '--execute' '${candidate_script}' '${promotion_script}'"
check "scripts contain no eval" bash -c "! grep -Eq '(^|[[:space:]])eval([[:space:]]|$)' '${candidate_script}' '${promotion_script}'"
check "Reviewer Model 3 is recorded" contains "${runbook}" "Reviewer Model 3"
check "self-review is prohibited" contains "${runbook}" "Self-review is prohibited"
check "five-release sunset is recorded" contains "${runbook}" "five successful Production releases"
check "90-day sunset is recorded" contains "${runbook}" "90 days from the recorded pilot activation date"
check "Model 1 transition is recorded" contains "${runbook}" "target governance model is Reviewer Model 1"
check "isolated actAs proof remains required" contains "${runbook}" 'promotion without runtime-service-account `actAs`'
check "privileged broker remains deferred" contains "${runbook}" "privileged release broker remains the preferred long-term architecture"
check "legacy deployer reuse remains prohibited" contains "${runbook}" "must not be reused"
check "no GitHub environment resource is added" bash -c "! grep -Eq 'production-(candidate|promotion).*environment resource|environment resource.*production-(candidate|promotion)' '${runbook}' '${decisions}'"
check "no Terraform resource is added" bash -c "test -z \"\$(git -C '${root}' status --porcelain -- '*.tf')\""
check "protected PRs remain out of scope" contains "${runbook}" "PR #1453, and PR #1435 remain out of scope"
check "Preview remains out of scope" contains "${runbook}" "Preview, Vercel, PR #1453"
check "no Vercel mutation is introduced" bash -c "test -z \"\$(git -C '${root}' status --porcelain -- 'rentchain-frontend/vercel.json')\""
check "no static GCP credential is proposed" contains "${decisions}" "No static GCP credential secret is proposed"
check "candidate workflow has no cloud mutation authority" contains "${candidate}" "cannot authenticate to Google Cloud and cannot deploy"
check "promotion workflow has no traffic mutation authority" contains "${promotion}" "cannot authenticate to Google Cloud and cannot change traffic"
check "Founder candidate authorization is separate" contains "${runbook}" "candidate authorization never implies promotion authorization"
check "rollback requires separate authorization" contains "${runbook}" "Rollback is a separate mutation and requires separate authorization"
check "decision status limits implementation" contains "${decisions}" "implementation is limited to the human-admin pilot"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
sha="0123456789abcdef0123456789abcdef01234567"
digest="$(printf 'a%.0s' $(seq 1 64))"
image="us-central1-docker.pkg.dev/project-0d9658de-af29-4dc0-a99/rentchain-api/rentchain-landlord-api@sha256:${digest}"
bash "${candidate_script}" "${sha}" "${image}" "sha-${sha}" project-0d9658de-af29-4dc0-a99 us-central1 rentchain-landlord-api candidate-123-1 https://github.com/rentchaincanada/rentchain/actions/runs/123 operator "${tmp}/candidate.json" >/dev/null
jq -e '.cloudMutationPerformed == false and .status == "prepared"' "${tmp}/candidate.json" >/dev/null
jq -n --arg sha "${sha}" --arg image "${image}" '{candidateRequestId:"candidate-123-1",sourceSha:$sha,imageUri:$image,candidateRevision:"rentchain-landlord-api-candidate-0123456789ab",previousReadyRevision:"rentchain-landlord-api-01967-djh",ready:true,trafficPercent:0}' > "${tmp}/human.json"
bash "${promotion_script}" "${tmp}/candidate.json" "${tmp}/human.json" promotion-456-1 https://github.com/rentchaincanada/rentchain/actions/runs/456 operator "${tmp}/promotion.json" >/dev/null
jq -e '.trafficMutationPerformed == false and .status == "prepared"' "${tmp}/promotion.json" >/dev/null
check "preparation scripts produce non-mutating evidence" test -s "${tmp}/promotion.json"

test "${pass}" -ge 30
printf 'Human-admin Production pilot validation passed (%d boundaries).\n' "${pass}"
