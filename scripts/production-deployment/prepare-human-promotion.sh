#!/usr/bin/env bash
set -euo pipefail

if test "$#" -ne 6; then
  echo "usage: $0 CANDIDATE_REQUEST_JSON HUMAN_EVIDENCE_JSON REQUEST_ID RUN_URL ACTOR OUTPUT_JSON" >&2
  exit 2
fi

candidate_request="$1"
human_evidence="$2"
request_id="$3"
run_url="$4"
actor="$5"
output_json="$6"

jq -e . "${candidate_request}" >/dev/null
[[ "${request_id}" =~ ^promotion-[A-Za-z0-9._-]+$ ]]
[[ "${run_url}" =~ ^https://github\.com/rentchaincanada/rentchain/actions/runs/[0-9]+$ ]]
test -n "${actor}"

source_sha="$(jq -r '.sourceSha' "${candidate_request}")"
image_uri="$(jq -r '.imageUri' "${candidate_request}")"
candidate_request_id="$(jq -r '.candidateRequestId' "${candidate_request}")"
project="$(jq -r '.project' "${candidate_request}")"
region="$(jq -r '.region' "${candidate_request}")"
service="$(jq -r '.service' "${candidate_request}")"

verified_human_evidence="$(
  jq -ce '
    . as $e |
    if (
      (.sourceSha | type == "string" and length == 40) and
      (.imageUri | type == "string" and contains("@sha256:")) and
      (.approvedDigest | type == "string" and test("^sha256:[0-9a-f]{64}$")) and
      ($e.imageUri | endswith("@" + $e.approvedDigest)) and
      (.candidateRequestId | type == "string" and length > 0) and
      (.candidateRevision | type == "string" and length > 0) and
      (.previousReadyRevision | type == "string" and length > 0) and
      (.servingRevisionAfterDeployment == .previousReadyRevision) and
      (.ready | type == "boolean" and . == true) and
      (.trafficPercent | type == "number" and . == 0) and
      (.templateParity | type == "boolean" and . == true) and
      (.servingTrafficPercent | type == "number" and . == 100) and
      (.productionHealthHttpStatus | type == "number" and . == 200)
    ) then {
      sourceSha,
      imageUri,
      digest: .approvedDigest,
      candidateRequestId,
      candidateRevision,
      previousReadyRevision,
      candidateReady: .ready,
      candidateTrafficPercent: .trafficPercent,
      templateParityPassed: .templateParity,
      currentServingRevision: .servingRevisionAfterDeployment,
      currentServingTrafficPercent: .servingTrafficPercent,
      productionHealthStatus: .productionHealthHttpStatus
    } else error("human candidate evidence does not satisfy the promotion contract") end
  ' "${human_evidence}"
)"

candidate_revision="$(jq -r '.candidateRevision' <<<"${verified_human_evidence}")"
previous_ready_revision="$(jq -r '.previousReadyRevision' <<<"${verified_human_evidence}")"

test "$(jq -r '.status' "${candidate_request}")" = "prepared"
test "$(jq -r '.cloudMutationPerformed' "${candidate_request}")" = "false"
test "$(jq -r '.sourceSha' <<<"${verified_human_evidence}")" = "${source_sha}"
test "$(jq -r '.imageUri' <<<"${verified_human_evidence}")" = "${image_uri}"
test "$(jq -r '.candidateRequestId' <<<"${verified_human_evidence}")" = "${candidate_request_id}"
[[ "${candidate_revision}" =~ ^rentchain-landlord-api-candidate-[0-9a-f]{12}$ ]]
[[ "${previous_ready_revision}" =~ ^rentchain-landlord-api-[0-9]{5}-[a-z0-9]{3}$ ]]

promotion_command="gcloud run services update-traffic ${service} --project=${project} --region=${region} --to-revisions=${candidate_revision}=100 --quiet"
rollback_command="gcloud run services update-traffic ${service} --project=${project} --region=${region} --to-revisions=${previous_ready_revision}=100 --quiet"

jq -n \
  --arg request_id "${request_id}" \
  --arg candidate_request_id "${candidate_request_id}" \
  --arg source_sha "${source_sha}" \
  --arg image_uri "${image_uri}" \
  --arg candidate_revision "${candidate_revision}" \
  --arg previous_ready_revision "${previous_ready_revision}" \
  --arg project "${project}" \
  --arg region "${region}" \
  --arg service "${service}" \
  --arg command "${promotion_command}" \
  --arg rollback "${rollback_command}" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg run_url "${run_url}" \
  --arg actor "${actor}" \
  --argjson human "${verified_human_evidence}" \
  '{schemaVersion:1,status:"prepared",promotionRequestId:$request_id,candidateRequestId:$candidate_request_id,sourceSha:$source_sha,imageUri:$image_uri,digest:$human.digest,candidateRevision:$candidate_revision,previousReadyRevision:$previous_ready_revision,candidateReady:$human.candidateReady,candidateTrafficPercent:$human.candidateTrafficPercent,templateParityPassed:$human.templateParityPassed,currentServingRevision:$human.currentServingRevision,currentServingTrafficPercent:$human.currentServingTrafficPercent,productionHealthStatus:$human.productionHealthStatus,project:$project,region:$region,service:$service,proposedHumanAdminTrafficCommand:$command,rollbackCommandTemplate:$rollback,prePromotionChecklist:["separate Founder promotion authorization","interactive administrator authentication","candidate evidence linkage verified","candidate revision ready at approved digest","candidate remains at zero traffic","current Production traffic and health recorded"],requiredPostPromotionEvidence:["administratorIdentity","promotionAuthorization","trafficCommand","trafficResult","healthResult","rollbackStatus","approverIdentity","incidentNotes"],preparedAt:$timestamp,workflowRunUrl:$run_url,workflowActor:$actor,noMutationStatement:"NO TRAFFIC MUTATION PERFORMED",trafficMutationPerformed:false}' > "${output_json}"

printf 'promotion request written to %s; NO TRAFFIC MUTATION PERFORMED\n' "${output_json}"
