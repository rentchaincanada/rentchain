<!-- markdownlint-disable MD013 -->

# Phase B HCP Terraform phase-separated identity evidence

## Executive summary

The Preview HCP Terraform trust path now separates plan and apply impersonation by the immutable `terraform_run_phase` claim. The existing planning account remains read-only. A dedicated apply account has only the four permissions needed to inspect the Preview project and enable an approved service during a manually confirmed apply.

The provider still requires the exact HCP organization, project, and workspace identifiers. It accepts only `plan` and `apply` run phases. Each service account trusts only its matching phase-specific principal set.

A fresh speculative run authenticated through the plan identity and produced exactly the approved three-service proposal: **3 to add, 0 to change, 0 to destroy**. No apply or import occurred. HCP state remains empty, auto-apply remains off, and B3 did not begin.

## Previous blocker

The prior provider condition accepted only `terraform_run_phase == "plan"`. HCP Terraform supports distinct plan and apply service-account variables, but the default Google dynamic-credential configuration uses one workload identity provider. Adding only `TFC_GCP_APPLY_SERVICE_ACCOUNT_EMAIL` would therefore have caused an apply token to fail the provider condition.

The revision preserves one pool and one provider while separating service-account impersonation by the mapped run-phase attribute.

## Fixed scope

| Boundary | Value |
| --- | --- |
| Google Cloud project | `rentchain-preview` |
| Project number | `501298948635` |
| HCP organization ID | `org-DQu8qPHc6zr3hBmB` |
| HCP project ID | `prj-aN9g8NbTvdnZbXTr` |
| HCP workspace ID | `ws-ebtKQ2gkLZuoRis4` |
| HCP workspace | `rentchain-preview-foundation` |
| WIF pool | `hcp-terraform-preview` |
| OIDC provider | `hcp-terraform` |
| Issuer | `https://app.terraform.io` |
| Source commit | `18ca00eea9b3f0a2231ae78e96ae4e723abc16df` |

No production project, state, credential, role, or resource is in scope.

## Provider mappings

The provider mappings are:

```text
google.subject=assertion.terraform_workspace_id
attribute.terraform_organization_id=assertion.terraform_organization_id
attribute.terraform_project_id=assertion.terraform_project_id
attribute.terraform_workspace_id=assertion.terraform_workspace_id
attribute.terraform_run_phase=assertion.terraform_run_phase
```

## Provider condition

The active condition is:

```text
assertion.terraform_organization_id=='org-DQu8qPHc6zr3hBmB' && assertion.terraform_project_id=='prj-aN9g8NbTvdnZbXTr' && assertion.terraform_workspace_id=='ws-ebtKQ2gkLZuoRis4' && assertion.terraform_run_phase in ['plan','apply']
```

The immutable ID checks exclude other organizations, HCP projects, and workspaces. The final membership check excludes every run phase other than `plan` and `apply`.

## Plan identity

Planning service account:

`hcp-terraform-preview@rentchain-preview.iam.gserviceaccount.com`

Its project role remains `projects/rentchain-preview/roles/hcpTerraformPreviewPlanViewer` with exactly:

- `resourcemanager.projects.get`
- `serviceusage.services.get`
- `serviceusage.services.list`

It does not have `serviceusage.services.enable`.

Its only Workload Identity User member is:

```text
principalSet://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/hcp-terraform-preview/attribute.terraform_run_phase/plan
```

The superseded exact-subject member was removed.

## Apply identity

Apply service account:

`hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com`

The account is for manually confirmed HCP Terraform apply phases in `rentchain-preview` only. It has no browser, runtime, Vercel, GitHub, production, Owner, Editor, Token Creator, or service-account administration role.

Its only Workload Identity User member is:

```text
principalSet://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/hcp-terraform-preview/attribute.terraform_run_phase/apply
```

## Apply role

The dedicated role is:

`projects/rentchain-preview/roles/hcpTerraformPreviewApply`

It contains exactly:

- `resourcemanager.projects.get`
- `serviceusage.services.enable`
- `serviceusage.services.get`
- `serviceusage.services.list`

The role is bound only to the apply service account on `rentchain-preview`. It cannot disable services or mutate IAM, WIF, service accounts, billing, workloads, or production resources.

## HCP workspace variables

The workspace contains exactly these non-sensitive environment variables:

| Variable | Purpose |
| --- | --- |
| `TFC_GCP_PROVIDER_AUTH` | Enable HCP dynamic Google credentials |
| `TFC_GCP_PRINCIPAL_TYPE` | Require service-account impersonation |
| `TFC_GCP_WORKLOAD_PROVIDER_NAME` | Select the canonical Preview provider |
| `TFC_GCP_PLAN_SERVICE_ACCOUNT_EMAIL` | Select the read-only planning account |
| `TFC_GCP_APPLY_SERVICE_ACCOUNT_EMAIL` | Select the dedicated apply account |

There is no `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL`, JSON credential, access token, refresh token, private key, or production variable.

## Fresh speculative plan

| Evidence | Value |
| --- | --- |
| Run ID | `run-PNR71XFobLyfGAi9` |
| Configuration version | `cv-r7Nf4rdLxKH3nHKo` |
| Source commit | `18ca00eea9b3f0a2231ae78e96ae4e723abc16df` |
| Run status | `planned_and_finished` |
| Plan-only | `true` |
| Auto-apply | `false` |
| Summary | `3 to add, 0 to change, 0 to destroy` |

The only proposed resource addresses are:

```text
google_project_service.approved_management["cloudresourcemanager.googleapis.com"]
google_project_service.approved_management["iam.googleapis.com"]
google_project_service.approved_management["serviceusage.googleapis.com"]
```

No IAM, WIF, service-account, billing, Cloud Run, Artifact Registry, Cloud Build, Firebase, Firestore, Storage, public-access, replacement, import, or deletion action appeared.

The run proves that a `plan` token can impersonate the plan account and read the target state. The run did not enter an apply stage and cannot be applied because it was created as a speculative plan.

## Phase-isolation evidence

| Assertion | Evidence | Result |
| --- | --- | --- |
| Plan token can impersonate plan account | Fresh remote plan completed through `TFC_GCP_PLAN_SERVICE_ACCOUNT_EMAIL` | Runtime-proven |
| Plan token cannot impersonate apply account | Apply account trusts only the `run_phase/apply` principal set | Configuration-proven |
| Apply token can impersonate apply account | Provider admits exact-workspace `apply`; apply account trusts only `run_phase/apply`; HCP apply variable selects it | Configuration-proven; runtime proof intentionally deferred |
| Apply token cannot impersonate plan account | Plan account trusts only the `run_phase/plan` principal set | Configuration-proven |
| Wrong organization is rejected | Provider condition fixes the organization ID | Configuration-proven |
| Wrong HCP project is rejected | Provider condition fixes the project ID | Configuration-proven |
| Wrong workspace is rejected | Provider condition fixes the workspace ID | Configuration-proven |
| Other run phase is rejected | Provider permits membership only in `['plan','apply']` | Configuration-proven |
| No unrestricted federation exists | Both account policies contain one exact phase principal set; project policy has no Workload Identity User binding | Inspected |

No HCP JWT was manufactured or exposed for negative testing. Runtime proof of apply-phase impersonation requires a separately authorized, manually confirmed apply run.

## Key, state, and workload evidence

- Plan service-account user-managed keys: **zero**.
- Apply service-account user-managed keys: **zero**.
- HCP state resources: **zero**.
- Workspace execution mode: **remote**.
- Auto-apply: **off**.
- Terraform apply runs confirmed by this mission: **zero**.
- Cloud Run Admin API: **disabled**.
- Artifact Registry API: **disabled**.
- Cloud workloads created by this mission: **zero**.
- Storage buckets observed: **zero**.

The project retains default Google services and the management/identity services established by the B1/B2 bootstrap. This mission did not enable an application or workload service.

## Production isolation

Every mutation targeted `rentchain-preview` or HCP workspace `ws-ebtKQ2gkLZuoRis4`. No production project, state, workspace, identity, credential, IAM policy, or resource was read or changed. A live production IAM diff was intentionally not attempted because production access remains prohibited.

PR #1435 remains draft, unchanged, and on hold.

## Cost impact

The service accounts, custom IAM role, WIF policy updates, HCP variable, and speculative plan have no expected incremental usage charge. Estimated incremental cost is approximately **CAD 0**.

## Rollback plan

Rollback is ordered to remove apply capability before restoring the prior plan-only trust:

1. Remove `TFC_GCP_APPLY_SERVICE_ACCOUNT_EMAIL` from the HCP workspace.
2. Remove the apply-phase Workload Identity User binding from the apply account.
3. Remove the apply custom-role project binding.
4. Delete the apply service account after reconfirming zero user-managed keys and dependencies.
5. Delete `projects/rentchain-preview/roles/hcpTerraformPreviewApply`.
6. Restore the provider condition to the exact organization, project, workspace, and `terraform_run_phase == 'plan'` restriction.
7. Remove the plan-phase principal-set binding and restore the original exact-workspace subject binding on the plan account.
8. Re-run a speculative plan and confirm the prior plan-only behavior and zero HCP state.

Rollback must not be executed without separate authorization unless required to contain a failed identity revision.

## Final classification and remaining gate

**Phase-separated apply identity validated.**

The plan path is runtime-proven and the cross-phase boundaries are configuration-proven. Apply-phase runtime proof and the three-service apply remain blocked pending separate Founder authorization for an exact non-speculative run. No Terraform apply occurred, B3 did not begin, and this evidence does not authorize either action.
