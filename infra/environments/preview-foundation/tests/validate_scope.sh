#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

expected_resources="google_project_service"
actual_resources="$(rg -No 'resource "[^"]+"' "$root_dir" --glob '*.tf' | sed -E 's/.*resource "([^"]+)"/\1/' | sort -u)"
test "$actual_resources" = "$expected_resources"

test "$(rg -No 'service\s*=\s*"[^"]+\.googleapis\.com"' "$root_dir/services.tf" | wc -l | tr -d ' ')" = "0"
test "$(rg -No '"(cloudresourcemanager|iam|serviceusage)\.googleapis\.com"' "$root_dir/services.tf" | sort -u | wc -l | tr -d ' ')" = "3"

rg -q 'organization = "Rentchain"' "$root_dir/versions.tf"
rg -q 'name = "rentchain-preview-foundation"' "$root_dir/versions.tf"
rg -q 'var\.project_id == "rentchain-preview"' "$root_dir/variables.tf"
rg -q 'var\.project_number == "501298948635"' "$root_dir/variables.tf"
rg -q 'var\.environment == "preview"' "$root_dir/variables.tf"
rg -q 'var\.project_id != "project-0d9658de-af29-4dc0-a99"' "$root_dir/variables.tf"

if rg -n 'credentials\s*=|credentials_file|GOOGLE_APPLICATION_CREDENTIALS|service_account_key|private_key' "$root_dir" --glob '*.tf'; then
  echo "Static credential reference found" >&2
  exit 1
fi

if rg -n 'allUsers|allAuthenticatedUsers|google_.*_iam|google_cloud_run|google_artifact_registry|google_storage_bucket|google_firestore|google_compute|google_container' "$root_dir" --glob '*.tf'; then
  echo "Public IAM or workload resource found" >&2
  exit 1
fi

echo "Preview foundation scope validation passed"
