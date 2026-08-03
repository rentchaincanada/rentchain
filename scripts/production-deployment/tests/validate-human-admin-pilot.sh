#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
candidate="${root}/.github/workflows/production-candidate-deploy.yml"
promotion="${root}/.github/workflows/production-candidate-promote.yml"
candidate_script="${root}/scripts/production-deployment/prepare-human-candidate.sh"
promotion_script="${root}/scripts/production-deployment/prepare-human-promotion.sh"
runbook="${root}/docs/operations/production-human-admin-release-pilot.md"
decisions="${root}/docs/operations/production-release-control-founder-decisions.md"
runtime_contract="${root}/scripts/production-deployment/tests/validate-backend-image-runtime.sh"
fatal_handler="${root}/rentchain-api/src/process/fatalStartup.ts"

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
check "candidate command adds the explicit Production project" contains "${tmp}/candidate.json" '--update-env-vars=GOOGLE_CLOUD_PROJECT=project-0d9658de-af29-4dc0-a99'
check "candidate command does not replace all environment variables" not_contains "${tmp}/candidate.json" '--set-env-vars'
check "candidate command does not clear environment variables" not_contains "${tmp}/candidate.json" '--clear-env-vars'
check "candidate command does not replace environment variables from a file" not_contains "${tmp}/candidate.json" '--env-vars-file'
check "candidate artifact records preserve-existing update semantics" bash -c "jq -e '.requiredProjectConfiguration == {name:\"GOOGLE_CLOUD_PROJECT\",value:\"project-0d9658de-af29-4dc0-a99\",updateSemantics:\"preserve-existing\"}' '${tmp}/candidate.json' >/dev/null"
jq -n --arg sha "${sha}" --arg image "${image}" --arg digest "sha256:${digest}" '{candidateRequestId:"candidate-123-1",sourceSha:$sha,imageUri:$image,approvedDigest:$digest,candidateRevision:"rentchain-landlord-api-candidate-0123456789ab",previousReadyRevision:"rentchain-landlord-api-01967-djh",servingRevisionAfterDeployment:"rentchain-landlord-api-01967-djh",ready:true,trafficPercent:0,templateParity:true,candidateInstanceStarted:true,candidateSmokeMethod:"dedicated-private-smoke-service",candidateSmokeHttpStatus:200,candidateSmokePath:"/health",candidateSmokeDigestVerified:true,candidateStartupLogObserved:true,candidateStartupError:null,servingTrafficPercent:100,productionHealthHttpStatus:200}' > "${tmp}/human.json"
bash "${promotion_script}" "${tmp}/candidate.json" "${tmp}/human.json" promotion-456-1 https://github.com/rentchaincanada/rentchain/actions/runs/456 operator "${tmp}/promotion.json" >/dev/null
jq -e '.trafficMutationPerformed == false and .status == "prepared"' "${tmp}/promotion.json" >/dev/null
check "preparation scripts produce non-mutating evidence" test -s "${tmp}/promotion.json"

expect_promotion_failure() {
  local evidence="$1"
  ! bash "${promotion_script}" "${tmp}/candidate.json" "${evidence}" promotion-invalid-1 https://github.com/rentchaincanada/rentchain/actions/runs/999 operator "${tmp}/invalid-promotion.json" >/dev/null 2>&1
}

check "promotion artifact records Boolean candidate readiness" bash -c "jq -e '.candidateReady == true and (.candidateReady | type) == \"boolean\"' '${tmp}/promotion.json' >/dev/null"
check "promotion artifact records integer zero candidate traffic" bash -c "jq -e '.candidateTrafficPercent == 0 and (.candidateTrafficPercent | type) == \"number\"' '${tmp}/promotion.json' >/dev/null"
check "promotion artifact records Boolean template parity" bash -c "jq -e '.templateParityPassed == true and (.templateParityPassed | type) == \"boolean\"' '${tmp}/promotion.json' >/dev/null"
check "promotion artifact records integer serving traffic" bash -c "jq -e '.currentServingTrafficPercent == 100 and (.currentServingTrafficPercent | type) == \"number\"' '${tmp}/promotion.json' >/dev/null"
check "promotion artifact records integer Production health" bash -c "jq -e '.productionHealthStatus == 200 and (.productionHealthStatus | type) == \"number\"' '${tmp}/promotion.json' >/dev/null"
check "promotion artifact records serving revision and immutable digest" bash -c "jq -e '.currentServingRevision == \"rentchain-landlord-api-01967-djh\" and (.digest | test(\"^sha256:[0-9a-f]{64}$\"))' '${tmp}/promotion.json' >/dev/null"
check "promotion artifact records successful immutable-image smoke evidence" bash -c "jq -e '.candidateInstanceStarted == true and .candidateSmokeMethod == \"dedicated-private-smoke-service\" and .candidateSmokeHttpStatus == 200 and .candidateSmokePath == \"/health\" and .candidateSmokeDigestVerified == true and .candidateStartupLogObserved == true and .candidateStartupError == null' '${tmp}/promotion.json' >/dev/null"

jq '.ready = false' "${tmp}/human.json" > "${tmp}/invalid-ready.json"
check "invalid candidate readiness fails closed" expect_promotion_failure "${tmp}/invalid-ready.json"
jq '.trafficPercent = 1' "${tmp}/human.json" > "${tmp}/invalid-candidate-traffic.json"
check "nonzero candidate traffic fails closed" expect_promotion_failure "${tmp}/invalid-candidate-traffic.json"
jq '.templateParity = false' "${tmp}/human.json" > "${tmp}/invalid-template-parity.json"
check "failed template parity fails closed" expect_promotion_failure "${tmp}/invalid-template-parity.json"
jq '.productionHealthHttpStatus = 503' "${tmp}/human.json" > "${tmp}/invalid-health.json"
check "non-200 Production health fails closed" expect_promotion_failure "${tmp}/invalid-health.json"
jq 'del(.servingTrafficPercent)' "${tmp}/human.json" > "${tmp}/missing-serving-traffic.json"
check "missing serving traffic fails closed" expect_promotion_failure "${tmp}/missing-serving-traffic.json"
jq '.candidateInstanceStarted = false' "${tmp}/human.json" > "${tmp}/candidate-not-started.json"
check "candidate smoke without a started instance fails closed" expect_promotion_failure "${tmp}/candidate-not-started.json"
jq 'del(.candidateSmokeMethod)' "${tmp}/human.json" > "${tmp}/missing-smoke-method.json"
check "missing candidate smoke method fails closed" expect_promotion_failure "${tmp}/missing-smoke-method.json"
jq '.candidateSmokeHttpStatus = 503' "${tmp}/human.json" > "${tmp}/failed-smoke-health.json"
check "non-200 candidate smoke fails closed" expect_promotion_failure "${tmp}/failed-smoke-health.json"
jq '.candidateSmokePath = "/health/ready"' "${tmp}/human.json" > "${tmp}/wrong-smoke-path.json"
check "wrong candidate smoke path fails closed" expect_promotion_failure "${tmp}/wrong-smoke-path.json"
jq '.candidateSmokeDigestVerified = false' "${tmp}/human.json" > "${tmp}/unverified-smoke-digest.json"
check "unverified candidate smoke digest fails closed" expect_promotion_failure "${tmp}/unverified-smoke-digest.json"
jq '.candidateStartupLogObserved = false' "${tmp}/human.json" > "${tmp}/missing-startup-log.json"
check "missing candidate startup log evidence fails closed" expect_promotion_failure "${tmp}/missing-startup-log.json"
jq '.candidateStartupError = "startup failed"' "${tmp}/human.json" > "${tmp}/startup-error.json"
check "candidate startup error fails closed" expect_promotion_failure "${tmp}/startup-error.json"

check "promotion artifact remains linked to exact candidate request" bash -c "jq -e '.candidateRequestId == \"candidate-123-1\" and .candidateRevision == \"rentchain-landlord-api-candidate-0123456789ab\"' '${tmp}/promotion.json' >/dev/null"
check "promotion command remains revision pinned" contains "${tmp}/promotion.json" '--to-revisions=rentchain-landlord-api-candidate-0123456789ab=100'
check "rollback command remains serving-revision pinned" contains "${tmp}/promotion.json" '--to-revisions=rentchain-landlord-api-01967-djh=100'
check "rollback evidence separates command exits from authoritative state" bash -c "jq -e '.requiredPostPromotionEvidence | index(\"trafficCommandExitCode\") and index(\"authoritativeTrafficState\") and index(\"authoritativeHealthState\") and index(\"rollbackCommandExitCode\") and index(\"rollbackAuthoritativeTrafficState\") and index(\"rollbackAuthoritativeHealthState\")' '${tmp}/promotion.json' >/dev/null"
check "corrected artifact records no traffic mutation" bash -c "jq -e '.trafficMutationPerformed == false and .noMutationStatement == \"NO TRAFFIC MUTATION PERFORMED\"' '${tmp}/promotion.json' >/dev/null"
check "corrected workflow still executes no traffic update" not_contains "${promotion}" "gcloud run services update-traffic"
check "corrected workflow executes no Cloud Run deploy" not_contains "${promotion}" "gcloud run deploy"
check "corrected workflow has no Google authentication" not_contains "${promotion}" "google-github-actions/auth"
check "corrected workflow has no OIDC write permission" not_contains "${promotion}" "id-token: write"
check "corrected workflow has no environment binding" not_contains "${promotion}" "environment:"
check "corrected workflow has no WIF or service-account variable" bash -c "! grep -Eq 'PRODUCTION_(WORKLOAD_IDENTITY_PROVIDER|DEPLOY|PROMOTION)_SERVICE_ACCOUNT' '${promotion}'"
check "corrected scripts contain no eval" bash -c "! grep -Eq '(^|[[:space:]])eval([[:space:]]|$)' '${promotion_script}'"
check "corrected scripts expose no apply or execute mode" bash -c "! grep -Eq -- '--(apply|execute)' '${promotion_script}'"
check "generated promotion fixture contains no credential material" bash -c "! grep -Eq 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}|gho_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|private_key|access_token|refresh_token|password|secretValue' '${tmp}/promotion.json'"
jq 'del(.candidateReady,.candidateTrafficPercent,.templateParityPassed,.candidateInstanceStarted,.candidateSmokeMethod,.candidateSmokeHttpStatus,.candidateSmokePath,.candidateSmokeDigestVerified,.candidateStartupLogObserved,.candidateStartupError,.currentServingTrafficPercent,.productionHealthStatus)' "${tmp}/promotion.json" > "${tmp}/prior-schema.json"
check "prior failed promotion artifact fails corrected contract" bash -c "! jq -e '.candidateReady == true and .candidateTrafficPercent == 0 and .templateParityPassed == true and .currentServingTrafficPercent == 100 and .productionHealthStatus == 200' '${tmp}/prior-schema.json' >/dev/null"

check "fatal startup sets a nonzero exit status" contains "${fatal_handler}" "processLike.exitCode = 1"
check "missing project rejects a zero exit" contains "${runtime_contract}" 'test "${missing_status}" -ne 0'
check "incorrect project rejects a zero exit" contains "${runtime_contract}" 'test "${wrong_status}" -ne 0'
check "successful startup still requires HTTP 200" contains "${runtime_contract}" 'test "${status}" = 200'
check "runtime contract uses amd64 explicitly" contains "${runtime_contract}" "--platform linux/amd64"
check "rejected digest remains ineligible" contains "${runbook}" "ineligible for smoke, candidate deployment, or promotion"
check "runtime correction introduces no deploy command" not_contains "${runtime_contract}" "gcloud run deploy"

test "${pass}" -eq 87
printf 'Human-admin Production pilot validation passed (%d boundaries).\n' "${pass}"
