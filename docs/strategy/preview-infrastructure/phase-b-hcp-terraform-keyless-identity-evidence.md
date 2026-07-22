# Phase B HCP Terraform Keyless Planning Identity Evidence

## Executive summary

The bounded HCP Terraform plan-phase identity bootstrap was created in the isolated `rentchain-preview` project. HCP Terraform initialization succeeded, but Terraform validation failed on the existing `baseline_labels` validation in the merged B2 root. The mission stopped immediately: no plan or apply ran and the three-service B2 proposal was not applied.

Final classification: **keyless Terraform identity requires revision**.

## Approved target

| Item | Value |
| --- | --- |
| Google project | `rentchain-preview` |
| Google project number | `501298948635` |
| HCP organization | `Rentchain` / `org-DQu8qPHc6zr3hBmB` |
| HCP project | `RentChain Preview` / `prj-aN9g8NbTvdnZbXTr` |
| HCP workspace | `rentchain-preview-foundation` / `ws-ebtKQ2gkLZuoRis4` |
| Terraform root | `infra/environments/preview-foundation` |

The workspace remained remote, CLI-driven, auto-apply off, and at zero state resources after the stopped validation. No production credential, state, project, or command target was used.

## Bootstrap method and enabled APIs

Founder-authenticated `gcloud` commands created the bootstrap identity. No service-account key or static Google credential was used.

Exactly four identity-bootstrap APIs were enabled:

- `cloudresourcemanager.googleapis.com`
- `iam.googleapis.com`
- `iamcredentials.googleapis.com`
- `sts.googleapis.com`

This did not apply the three `google_project_service` resources proposed by B2. No workload, build, registry, Firebase, Firestore, Storage, Vercel, or application API was enabled by this mission.

## Workload Identity Federation

| Resource | Value |
| --- | --- |
| Pool | `projects/501298948635/locations/global/workloadIdentityPools/hcp-terraform-preview` |
| Provider | `projects/501298948635/locations/global/workloadIdentityPools/hcp-terraform-preview/providers/hcp-terraform` |
| Issuer | `https://app.terraform.io` |
| Audience | Google canonical provider audience (default audience) |
| Provider state | Active |

Attribute mappings:

```text
google.subject=assertion.terraform_workspace_id
attribute.terraform_organization_id=assertion.terraform_organization_id
attribute.terraform_project_id=assertion.terraform_project_id
attribute.terraform_workspace_id=assertion.terraform_workspace_id
attribute.terraform_run_phase=assertion.terraform_run_phase
```

Exact provider condition:

```text
assertion.terraform_organization_id=='org-DQu8qPHc6zr3hBmB' && assertion.terraform_project_id=='prj-aN9g8NbTvdnZbXTr' && assertion.terraform_workspace_id=='ws-ebtKQ2gkLZuoRis4' && assertion.terraform_run_phase=='plan'
```

Mutable names are not used in the trust decision. Apply-phase tokens, other organizations, other HCP projects, other workspaces, and organization-level tokens fail the condition.

## Service account, role, and bindings

Dedicated service account:

`hcp-terraform-preview@rentchain-preview.iam.gserviceaccount.com`

User-managed key count: **zero**.

Custom project role:

`projects/rentchain-preview/roles/hcpTerraformPreviewPlanViewer`

Exact permissions:

- `resourcemanager.projects.get`
- `serviceusage.services.get`
- `serviceusage.services.list`

The custom role is bound to the dedicated service account in `rentchain-preview` only. The only `roles/iam.workloadIdentityUser` binding is on the service account and uses this exact subject:

```text
principal://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/hcp-terraform-preview/subject/ws-ebtKQ2gkLZuoRis4
```

No wildcard or `principalSet` federation exists. No project-level Workload Identity User binding exists. No Token Creator role was granted.

## HCP Terraform variables

Four non-sensitive workspace environment variables were configured:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `TFC_GCP_PROVIDER_AUTH` | Workspace | Enable HCP dynamic GCP credentials |
| `TFC_GCP_PRINCIPAL_TYPE` | Workspace | Require service-account impersonation |
| `TFC_GCP_WORKLOAD_PROVIDER_NAME` | Workspace | Select the canonical Preview provider |
| `TFC_GCP_PLAN_SERVICE_ACCOUNT_EMAIL` | Workspace | Select the plan-only Preview service account |

No run or apply service-account variable, JSON credential, token, key, or production variable was configured.

## Terraform execution evidence

`terraform init` succeeded from the isolated root and installed `hashicorp/google` v6.50.0. The generated dependency lock file is committed with this evidence.

`terraform validate` did not pass. It stopped with:

```text
Invalid value for variable baseline_labels
baseline_labels must exactly match the approved B1 Preview label set.
```

The failure points to the equality validation in `variables.tf`. No retry, source fix, IAM change, remote plan, or apply followed the error.

Remote plan result: **not run**. Exact plan summary: **none**. B2 project-service resources applied: **zero**.

## Negative-test evidence

| Test | Result |
| --- | --- |
| Wrong organization | Denied by immutable provider condition; configuration verified |
| Wrong HCP project | Denied by immutable provider condition; configuration verified |
| Wrong workspace | Denied by immutable provider condition and exact subject binding; configuration verified |
| Production workspace | No trust or binding exists; configuration verified |
| Apply phase | Denied by `terraform_run_phase=='plan'`; no apply identity variable exists |
| Missing or malformed token | No unauthenticated path exists; active exchange test not reached |
| Wrong audience | Google default canonical audience enforced; active exchange test not reached |
| Static service-account keys | Zero |
| Wildcard federation | Zero |
| Project-level Workload Identity User | Zero |
| Auto-apply | Off |
| Apply confirmation | None |

Token-bearing negative requests were not fabricated after the validation stop. No JWT, access token, ID token, authorization header, or credential was captured.

## Production isolation and cost

Every modifying Google command explicitly targeted `rentchain-preview`. Production access was prohibited and no production command or credential was used. A production IAM read/diff was intentionally not performed; command-target evidence shows no production mutation.

Expected incremental cost for the pool, provider, service account, IAM bindings, and custom role is approximately CAD 0. API and audit logging remain subject to Google pricing, while the existing CAD 100 monthly ceiling and CAD 15 anomaly threshold remain unchanged.

## Residual resources

- four enabled identity-bootstrap APIs;
- one workload identity pool;
- one OIDC provider;
- one dedicated service account with zero user-managed keys;
- one three-permission custom role;
- one project-level custom-role binding;
- one service-account-level exact-subject Workload Identity User binding;
- four non-sensitive HCP workspace environment variables;
- zero HCP state resources;
- zero Terraform applies.

## Rollback sequence

Rollback requires separate authorization and must proceed in reverse order:

1. Delete the four HCP workspace variables by their HCP variable IDs.
2. Remove the exact service-account-level `roles/iam.workloadIdentityUser` binding.
3. Remove the custom project-role binding from the dedicated service account.
4. Delete custom role `hcpTerraformPreviewPlanViewer`.
5. Delete service account `hcp-terraform-preview` after reconfirming zero keys and dependencies.
6. Delete provider `hcp-terraform`, then pool `hcp-terraform-preview`.
7. Disable only the four bootstrap APIs after confirming no remaining dependency.

Do not execute rollback against production or infer deletion authorization from this document.

## Stage boundary

B3 did not begin. PR #1435 remains unchanged and on hold. The next action is a narrow correction and review of the B2 `baseline_labels` validation, followed by a separately authorized validation retry and plan-only run. No apply is authorized.
