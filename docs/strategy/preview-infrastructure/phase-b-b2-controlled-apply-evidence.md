<!-- markdownlint-disable MD013 -->

# Phase B B2 controlled Preview foundation apply evidence

## Executive summary

The exact Founder-approved HCP Terraform run completed successfully in the isolated `rentchain-preview` project. The apply added exactly three Terraform state resources representing the already-enabled Cloud Resource Manager, IAM, and Service Usage APIs. It made no changes or destroys and imported no resources.

A subsequent speculative plan found zero drift. HCP state contains exactly the approved three `google_project_service` addresses. No workload API, IAM resource, WIF resource, service account, billing resource, public-access resource, or production resource entered the Preview foundation state.

Final classification: **B2 controlled apply complete**. This evidence does not authorize B3.

## Approval boundary

Founder approval was recorded against this exact run before confirmation:

| Field | Value |
| --- | --- |
| Run | `run-nuWNzpLjbnBcPokD` |
| Configuration version | `cv-4B7shFEcvWaCwynd` |
| Source commit | `206b0022744a96f6e66ded3413b33703e9013795` |
| Workspace | `rentchain-preview-foundation` |
| Workspace ID | `ws-ebtKQ2gkLZuoRis4` |
| Target project | `rentchain-preview` |
| Target project number | `501298948635` |
| Approved plan | `3 to add, 0 to change, 0 to destroy` |
| Auto-apply | Off |

The approval applied only to the three service resources listed below. No prior or general authorization was substituted for exact-run approval.

## Apply result

| Evidence | Value |
| --- | --- |
| Final run status | `applied` |
| Apply ID | `apply-GZJDs27n1wUNEdzA` |
| Apply status | `finished` |
| Resources added | `3` |
| Resources changed | `0` |
| Resources destroyed | `0` |
| Resources imported | `0` |
| State version | `sv-koc7MNtdeYJEhUnC` |
| State serial | `1` |
| State creation time | `2026-07-22T04:27:34.376Z` |

The apply completed through the dedicated keyless apply account:

`hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com`

This runtime result proves that the apply-phase HCP token passed the immutable provider condition and the apply-phase principal-set binding. No static credential or service-account key was used.

## Final state inventory

HCP Terraform reports exactly three state resources:

```text
google_project_service.approved_management["cloudresourcemanager.googleapis.com"]
google_project_service.approved_management["iam.googleapis.com"]
google_project_service.approved_management["serviceusage.googleapis.com"]
```

No other address exists in the workspace state.

All three services were already enabled during the bounded administrative and identity bootstrap. The apply adopted their enabled status into Terraform management. Each resource is configured with `disable_on_destroy = false` and `disable_dependent_services = false`.

## Enabled-service verification

The following approved services are enabled:

- `cloudresourcemanager.googleapis.com`
- `iam.googleapis.com`
- `serviceusage.googleapis.com`

The apply log contains only these three create/adoption operations. It records **3 added, 0 changed, 0 destroyed, and 0 imported**.

The following workload or application APIs remain disabled:

- Cloud Run Admin: `run.googleapis.com`
- Artifact Registry: `artifactregistry.googleapis.com`
- Cloud Build: `cloudbuild.googleapis.com`
- Firebase Management: `firebase.googleapis.com`
- Firestore: `firestore.googleapis.com`

Storage bucket count remains **zero**. The only custom service accounts are the previously approved HCP Terraform plan and apply identities. No application workload exists.

## Post-apply zero-drift plan

| Evidence | Value |
| --- | --- |
| Run | `run-aucBxAxXMm89AvYV` |
| Configuration version | `cv-B72RXLYwYukx1aAZ` |
| Plan ID | `plan-Wiq6ynp1Ey3THGoE` |
| Run type | Speculative, plan-only |
| Run status | `planned_and_finished` |
| Result | `0 to add, 0 to change, 0 to destroy` |

Terraform refreshed all three state resources and reported:

```text
No changes. Your infrastructure matches the configuration.
```

No corrective action was required.

## Identity and key evidence

The provider remains restricted to the exact HCP organization, project, workspace, and `plan` or `apply` run phases. The plan account trusts only the plan-phase principal set. The apply account trusts only the apply-phase principal set.

| Identity | User-managed keys |
| --- | --- |
| `hcp-terraform-preview@rentchain-preview.iam.gserviceaccount.com` | `0` |
| `hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com` | `0` |

Auto-apply remains off. No project-level Workload Identity User binding, wildcard federation, Token Creator role, static credential, JSON key, or run-wide service-account variable was added.

## Production isolation

The run, state, APIs, service accounts, and verification commands targeted only `rentchain-preview` and HCP workspace `ws-ebtKQ2gkLZuoRis4`. No production project, state, IAM policy, credential, workload, or data was accessed or modified.

PR #1435 remains unchanged, draft, and on hold. B3 did not begin.

## Cost impact

The three management APIs were already enabled, and this apply recorded their state under Terraform management. No billable workload was created. Expected incremental cost is approximately **CAD 0**.

## Rollback implications

Rollback is not required because the apply and post-apply plan succeeded.

If a later separately authorized rollback removes these resources from Terraform management, `disable_on_destroy = false` prevents Terraform from disabling the underlying APIs. The state and configuration removal must still be reviewed together. Any later API disablement requires a separate dependency review and explicit authorization.

Identity rollback remains separate from foundation-state rollback. The plan/apply WIF bindings, service accounts, custom roles, and HCP variables must not be removed as an incidental consequence of state rollback.

## Final classification

**B2 controlled apply complete.**

The Preview foundation now manages exactly the three approved project-service resources with zero observed drift. No application infrastructure, workload, B3 implementation, or PR #1435 change was introduced.
