#!/usr/bin/env bash
set -euo pipefail

if test "$#" -ne 10; then
  echo "usage: $0 SOURCE_SHA IMAGE_URI EXPECTED_TAG PROJECT REGION SERVICE REQUEST_ID RUN_URL ACTOR OUTPUT_JSON" >&2
  exit 2
fi

source_sha="$1"
image_uri="$2"
expected_tag="$3"
project="$4"
region="$5"
service="$6"
request_id="$7"
run_url="$8"
actor="$9"
output_json="${10}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "${root}/scripts/production-deployment/validate-release-inputs.sh" \
  candidate "${source_sha}" "${image_uri}" "${project}" "${region}" "${service}" >/dev/null

test "${expected_tag}" = "sha-${source_sha}"
[[ "${request_id}" =~ ^candidate-[A-Za-z0-9._-]+$ ]]
[[ "${run_url}" =~ ^https://github\.com/rentchaincanada/rentchain/actions/runs/[0-9]+$ ]]
test -n "${actor}"

suffix="candidate-${source_sha:0:12}"
command_template="gcloud run deploy ${service} --image=${image_uri} --project=${project} --region=${region} --revision-suffix=${suffix} --no-traffic --quiet"

jq -n \
  --arg request_id "${request_id}" \
  --arg source_sha "${source_sha}" \
  --arg image_uri "${image_uri}" \
  --arg expected_tag "${expected_tag}" \
  --arg project "${project}" \
  --arg region "${region}" \
  --arg service "${service}" \
  --arg command "${command_template}" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg run_url "${run_url}" \
  --arg actor "${actor}" \
  '{schemaVersion:1,status:"prepared",candidateRequestId:$request_id,sourceSha:$source_sha,imageUri:$image_uri,expectedTag:$expected_tag,project:$project,region:$region,service:$service,proposedHumanAdminCommand:$command,preflightChecklist:["fresh Founder candidate authorization","interactive administrator authentication","source SHA on main","build provenance and immutable digest verified","active trigger and builder identity verified","Production baseline and health recorded","no active deployment"],requiredPostDeploymentEvidence:["administratorIdentity","candidateRevision","candidateTimestamp","zeroTrafficProof","readinessProof","revisionDigestProof","templateParityProof","serviceHealthResult"],preparedAt:$timestamp,workflowRunUrl:$run_url,workflowActor:$actor,cloudMutationPerformed:false}' > "${output_json}"

printf 'candidate request written to %s; NO CLOUD MUTATION PERFORMED\n' "${output_json}"
