# Phase B HCP Terraform Keyless Planning Identity Evidence

## Executive summary

The bounded HCP Terraform plan-phase identity is validated in the isolated `rentchain-preview` project. After a narrow correction to the `baseline_labels` type comparison, focused tests and Terraform validation passed and one remote keyless plan completed. The plan contains exactly the three approved project-service resources. No apply ran and the three-service B2 proposal remains unapplied.

Final classification: **keyless Terraform planning identity validated**.

## Approved target

| Item | Value |
| --- | --- |
| Google project | `rentchain-preview` |
| Google project number | `501298948635` |
| HCP organization | `Rentchain` / `org-DQu8qPHc6zr3hBmB` |
| HCP project | `RentChain Preview` / `prj-aN9g8NbTvdnZbXTr` |
| HCP workspace | `rentchain-preview-foundation` / `ws-ebtKQ2gkLZuoRis4` |
| Terraform root | `infra/environments/preview-foundation` |

The workspace remained remote, CLI-driven, auto-apply off, and at zero state resources after the plan. No production credential, state, project, or command target was used.

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

### Validation diagnosis and correction

The original validation compared `var.baseline_labels`, declared as `map(string)`, directly with an object literal:

```text
var.baseline_labels == { ... }
```

Terraform equality requires values with compatible types. A converted `map(string)` and an object literal are not equal merely because they contain the same string keys and values. This was an object-versus-map mismatch, not a map-ordering, null, missing-key, or cross-variable problem.

The merged B1/B2 policy requires an exact map: all six approved labels are mandatory and additional labels are prohibited. The correction preserves that policy by normalizing the literal before comparison:

```text
var.baseline_labels == tomap({ ... })
```

No label, project, environment, API, provider, IAM, or identity safeguard was weakened.

### Focused tests and validation

Terraform native tests use a mocked Google provider and require no cloud credentials. Results: **12 passed, 0 failed**.

- exact approved labels pass;
- an additional label fails;
- missing environment, lifecycle, platform, purpose, or `managed-by` fails;
- production environment, wrong purpose, and wrong owner fail;
- the production project ID fails;
- a wrong project number fails.

`terraform fmt -check -recursive`, the repository scope validation, and `terraform validate` passed after the correction.

### Remote plan

HCP run `run-Z9oirF7PaGDkSGJq` authenticated successfully with the plan-only dynamic identity. Exact summary:

```text
Plan: 3 to add, 0 to change, 0 to destroy.
```

The only planned addresses are:

- `google_project_service.approved_management["cloudresourcemanager.googleapis.com"]`;
- `google_project_service.approved_management["iam.googleapis.com"]`;
- `google_project_service.approved_management["serviceusage.googleapis.com"]`.

Cloud Resource Manager and IAM were enabled manually for identity bootstrap, and Service Usage was already enabled. Because these enabled services are not yet represented in Terraform state, the provider reports all three as creates; a future apply would adopt/manage the existing service configuration rather than recreate a workload. No import or apply was attempted. No drift or unexpected resource appeared.

Apply result: **not run**. B2 project-service resources applied: **zero**. HCP state resources after plan: **zero**.

## Negative-test evidence

| Test | Result |
| --- | --- |
| Wrong organization | Denied by immutable provider condition; configuration verified |
| Wrong HCP project | Denied by immutable provider condition; configuration verified |
| Wrong workspace | Denied by immutable provider condition and exact subject binding; configuration verified |
| Production workspace | No trust or binding exists; configuration verified |
| Apply phase | Denied by `terraform_run_phase=='plan'`; no apply identity variable exists |
| Missing or malformed token | No unauthenticated path exists; unsupported synthetic token testing was not attempted |
| Wrong audience | Google default canonical audience enforced; unsupported synthetic token testing was not attempted |
| Static service-account keys | Zero |
| Wildcard federation | Zero |
| Project-level Workload Identity User | Zero |
| Auto-apply | Off |
| Apply confirmation | None |

The successful remote plan proves the exact HCP plan identity exchange. Token-bearing negative requests were not fabricated because HCP does not expose a safe supported mechanism for those tests. No JWT, access token, ID token, authorization header, or credential was captured.

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
- one completed plan-only HCP run containing exactly three approved service resources;
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

B3 did not begin. PR #1435 remains unchanged and on hold. The keyless planning identity is validated, but the captured three-service plan remains unapplied. Any apply requires a separate exact-plan authorization.
