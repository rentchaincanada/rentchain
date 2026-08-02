#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
build="${root}/rentchain-api/cloudbuild.yaml"
candidate="${root}/.github/workflows/production-candidate-deploy.yml"
promotion="${root}/.github/workflows/production-candidate-promote.yml"
guard="${root}/scripts/production-deployment/validate-release-inputs.sh"
classifier="${root}/scripts/production-deployment/classify-changed-paths.sh"
contract="${root}/scripts/production-deployment/validate-service-contract.jq"
template="${root}/scripts/production-deployment/governed-template.jq"

for file in "${build}" "${candidate}" "${promotion}" "${guard}" "${classifier}" "${contract}" "${template}"; do
  test -f "${file}"
done

test "$(rg -n 'gcloud run deploy|update-traffic|--allow-unauthenticated|--no-traffic' "${build}" | wc -l | tr -d ' ')" = "0"
grep -Fq 'sha-${COMMIT_SHA}' "${build}"
grep -Fq 'docker push' "${build}"
grep -Fq 'workflow_dispatch:' "${candidate}"
test "$(rg -n 'environment:|id-token: write|google-github-actions/auth' "${candidate}" | wc -l | tr -d ' ')" = "0"
grep -Fq 'NO CLOUD MUTATION PERFORMED' "${candidate}"
grep -Fq 'prepare-human-candidate.sh' "${candidate}"
test "$(rg -n 'update-traffic' "${candidate}" | wc -l | tr -d ' ')" = "0"
grep -Fq 'workflow_dispatch:' "${promotion}"
test "$(rg -n 'environment:|id-token: write|google-github-actions/auth' "${promotion}" | wc -l | tr -d ' ')" = "0"
grep -Fq 'Require successful candidate preparation run' "${promotion}"
grep -Fq 'Validate candidate and human-admin evidence binding' "${promotion}"
grep -Fq 'production-candidate-request' "${candidate}"
grep -Fq 'production-candidate-request' "${promotion}"
grep -Fq 'NO TRAFFIC MUTATION PERFORMED' "${promotion}"
test "$(rg -n 'update-traffic' "${promotion}" | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'gcloud run deploy' "${promotion}" | wc -l | tr -d ' ')" = "0"

sha="0123456789abcdef0123456789abcdef01234567"
digest="$(printf 'a%.0s' $(seq 1 64))"
image="us-central1-docker.pkg.dev/project-0d9658de-af29-4dc0-a99/rentchain-api/rentchain-landlord-api@sha256:${digest}"
bash "${guard}" candidate "${sha}" "${image}" project-0d9658de-af29-4dc0-a99 us-central1 rentchain-landlord-api >/dev/null
if bash "${guard}" candidate short "${image}" project-0d9658de-af29-4dc0-a99 us-central1 rentchain-landlord-api >/dev/null 2>&1; then exit 1; fi
if bash "${guard}" candidate "${sha}" "${image%@*}:mutable" project-0d9658de-af29-4dc0-a99 us-central1 rentchain-landlord-api >/dev/null 2>&1; then exit 1; fi
if bash "${guard}" candidate "${sha}" "${image}" rentchain-preview us-central1 rentchain-landlord-api >/dev/null 2>&1; then exit 1; fi
if bash "${guard}" candidate "${sha}" "${image}" project-0d9658de-af29-4dc0-a99 us-central1 rentchain-preview-backend >/dev/null 2>&1; then exit 1; fi

backend_result="$(bash "${classifier}" rentchain-api/package.json)"
grep -Fq $'build-required\trentchain-api/package.json' <<<"${backend_result}"
grep -Fq 'deployment_authorized=false' <<<"${backend_result}"
preview_result="$(bash "${classifier}" infra/environments/preview-foundation/datastore_auth.tf)"
grep -Fq $'no-build\tinfra/environments/preview-foundation/datastore_auth.tf' <<<"${preview_result}"
grep -Fq 'build_required=false' <<<"${preview_result}"
frontend_result="$(bash "${classifier}" rentchain-frontend/src/main.tsx)"
grep -Fq $'no-build\trentchain-frontend/src/main.tsx' <<<"${frontend_result}"

incident_service="$(mktemp)"
valid_service="$(mktemp)"
missing_secret_service="$(mktemp)"
valid_revision="$(mktemp)"
drifted_revision="$(mktemp)"
misplaced_service="$(mktemp)"
misplaced_revision="$(mktemp)"
conflicting_service="$(mktemp)"
malformed_service="$(mktemp)"
unrecognized_resource="$(mktemp)"
trap 'rm -f "${incident_service}" "${valid_service}" "${missing_secret_service}" "${valid_revision}" "${drifted_revision}" "${misplaced_service}" "${misplaced_revision}" "${conflicting_service}" "${malformed_service}" "${unrecognized_resource}"' EXIT
printf '%s\n' '{"spec":{"template":{"spec":{"containers":[{"env":[{"name":"JWT_SECRET","valueFrom":{"secretKeyRef":{"name":"JWT_SECRET","key":"latest"}}},{"name":"FIREBASE_API_KEY","valueFrom":{"secretKeyRef":{"name":"FIREBASE_API_KEY","key":"latest"}}}]}]}}}}' > "${incident_service}"
contract_result="$(jq -f "${contract}" "${incident_service}")"
grep -Fq '"GOOGLE_CLOUD_PROJECT"' <<<"${contract_result}"
test "$(jq -r '.ok' <<<"${contract_result}")" = "false"

jq -n '{spec:{template:{metadata:{annotations:{"autoscaling.knative.dev/maxScale":"20","run.googleapis.com/startup-cpu-boost":"true"}},spec:{serviceAccountName:"production-runtime-service-account",containerConcurrency:80,timeoutSeconds:300,containers:[{ports:[{containerPort:8080,name:"http1"}],resources:{limits:{cpu:"1000m",memory:"512Mi"}},startupProbe:{httpGet:{path:"/health/ready",port:8080}},livenessProbe:{httpGet:{path:"/health",port:8080}},env:(( ["JWT_SECRET","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","INTERNAL_JOB_TOKEN","FIREBASE_API_KEY","MAILGUN_API_KEY"] | map({name:.,valueFrom:{secretKeyRef:{name:.,key:"latest"}}}) ) + [{name:"GOOGLE_CLOUD_PROJECT",value:"project-0d9658de-af29-4dc0-a99"},{name:"FRONTEND_URL",value:"configured"},{name:"STRIPE_PRICE_STARTER_MONTHLY_LIVE",value:"configured"},{name:"STRIPE_PRICE_PRO_MONTHLY_LIVE",value:"configured"},{name:"STRIPE_PRICE_ELITE_MONTHLY_LIVE",value:"configured"},{name:"EMAIL_PROVIDER",value:"mailgun"},{name:"MAILGUN_DOMAIN",value:"configured"},{name:"EMAIL_FROM",value:"configured"}])}]}}}}' > "${valid_service}"
test "$(jq -r -f "${contract}" "${valid_service}" | jq -r '.ok')" = "true"
jq '(.spec.template.spec.containers[0].env[] | select(.name == "JWT_SECRET")) |= {name:"JWT_SECRET",value:"not-a-secret-reference"}' "${valid_service}" > "${missing_secret_service}"
test "$(jq -r -f "${contract}" "${missing_secret_service}" | jq -r '.ok')" = "false"
grep -Fq 'JWT_SECRET' <(jq -c -f "${contract}" "${missing_secret_service}")

jq '{metadata:{annotations:.spec.template.metadata.annotations},spec:.spec.template.spec}' "${valid_service}" > "${valid_revision}"
service_template="$(jq -S -f "${template}" "${valid_service}")"
revision_template="$(jq -S -f "${template}" "${valid_revision}")"
test "$(jq -r '.maxScale' <<<"${service_template}")" = "20"
test "$(jq -r '.maxScale' <<<"${revision_template}")" = "20"
test "$(jq -r '.startupCpuBoost' <<<"${service_template}")" = "true"
test "$(jq -r '.startupCpuBoost' <<<"${revision_template}")" = "true"
test "${service_template}" = "${revision_template}"

jq '.metadata.annotations["autoscaling.knative.dev/maxScale"] = "21"' "${valid_revision}" > "${drifted_revision}"
test "${service_template}" != "$(jq -S -f "${template}" "${drifted_revision}")"

jq 'del(.spec.template.metadata.annotations) | .metadata.annotations["autoscaling.knative.dev/maxScale"] = "999"' "${valid_service}" > "${misplaced_service}"
test "$(jq -r -f "${template}" "${misplaced_service}" | jq -r '.maxScale')" = "null"

jq 'del(.metadata.annotations) | .spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"] = "999"' "${valid_revision}" > "${misplaced_revision}"
test "$(jq -r -f "${template}" "${misplaced_revision}" | jq -r '.maxScale')" = "null"

jq '.metadata.annotations["autoscaling.knative.dev/maxScale"] = "21"' "${valid_service}" > "${conflicting_service}"
if jq -f "${template}" "${conflicting_service}" >/dev/null 2>&1; then exit 1; fi

jq '.spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"] = 20' "${valid_service}" > "${malformed_service}"
if jq -f "${template}" "${malformed_service}" >/dev/null 2>&1; then exit 1; fi

printf '%s\n' '{"spec":{"containers":null}}' > "${unrecognized_resource}"
if jq -f "${template}" "${unrecognized_resource}" >/dev/null 2>&1; then exit 1; fi

grep -Fq 'cloudMutationPerformed == false' "${candidate}"
grep -Fq 'trafficMutationPerformed == false' "${promotion}"
grep -Fq 'cannot authenticate to Google Cloud and cannot deploy' "${candidate}"

printf '%s\n' 'Production deployment governance validation passed (32 boundaries).'
