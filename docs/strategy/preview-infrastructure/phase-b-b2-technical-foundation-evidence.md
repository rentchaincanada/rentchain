# Phase B B2 Technical Foundation Evidence

## Executive summary

Phase B B2 now has a repository-defined, isolated Terraform foundation mapped to the dedicated HCP Terraform workspace. No Terraform apply occurred, no API was enabled by this change, and no cloud resource, identity, workload, data service, or Vercel configuration was created.

Current classification: **B2 awaiting controlled keyless Terraform identity**.

## Verified starting baseline

The Founder supplied and Codex reconfirmed the following before implementation:

- active account `admin@rentchain.ai` and configuration `rentchain-preview`;
- project `rentchain-preview`, number `501298948635`, lifecycle active, billing enabled;
- approved Preview labels and CAD 100 monthly planning ceiling;
- no custom service accounts, buckets, Cloud Run workload, Artifact Registry repository, or Phase B workload API intentionally enabled;
- HCP Terraform organization `Rentchain`, project `RentChain Preview`, workspace `rentchain-preview-foundation`;
- CLI-driven remote execution, zero resources/configuration, no production state or VCS connection, and auto-apply/auto-destroy off.

New Google projects contain default Google-managed services. They are not represented as Phase B workload enablement or managed by this root. The B2 allowlist concerns only services intentionally proposed by this configuration.

## Repository and state boundary

The isolated root is `infra/environments/preview-foundation`. Its cloud block fixes the HCP organization and workspace. It does not read production remote state and does not reuse the repository-root Terraform configuration, which contains production-oriented workloads and unsafe Preview assumptions.

Required inputs have no defaults. Plan-time validations require the exact Preview project ID, project number, environment, label baseline, and monthly ceiling. The known production project ID is denied explicitly.

## Proposed API plan

| Proposed resource address | Service | Justification |
| --- | --- | --- |
| `google_project_service.approved_management["cloudresourcemanager.googleapis.com"]` | Cloud Resource Manager | Bounded project foundation management |
| `google_project_service.approved_management["iam.googleapis.com"]` | Identity and Access Management | Prerequisite for later separately authorized keyless identity work |
| `google_project_service.approved_management["serviceusage.googleapis.com"]` | Service Usage | Explicit management API allowlist |

No API has been enabled by this PR. IAM Credentials and Security Token Service remain excluded until a keyless authentication design is separately authorized. No workload or data API appears in the proposal.

## Authentication status

The root contains no static credential path or cloud identity resource. HCP Terraform has no authorized Google identity in this stage, so no cloud-backed remote plan or apply is permitted. The next dependency is a separately authorized, least-privilege, keyless Terraform planning identity design and exact IAM review.

## Apply and destroy controls

- Remote auto-apply and auto-destroy are off.
- Founder — Paul must explicitly approve an exact captured plan.
- The project target and resource addresses must be reviewed before apply.
- API resources use `prevent_destroy` and retain services on state removal.
- Production state and remote-state dependencies are prohibited.
- No local state may become authoritative.
- No automatic or undocumented destroy is allowed.

## Cost impact

Repository implementation and the un-applied API proposal have CAD 0 cloud-resource cost. Enabling the three management APIs has no direct enablement charge, but later use of billable services is not authorized. The existing CAD 100 monthly planning ceiling and CAD 15 daily anomaly threshold remain unchanged.

## Residual resources and rollback

Exact resources created by this implementation: **none**.

Rollback before apply is deletion or reversion of the isolated root and documentation, with the empty HCP workspace retained for audit unless separately approved for removal. After any future apply, rollback requires a separately reviewed plan because `prevent_destroy` intentionally blocks automatic service removal.

## Stage boundary

B3 is not authorized. No service account, IAM binding, WIF resource, Cloud Run service, Artifact Registry repository, Cloud Build resource, Firebase/Firestore/Storage resource, application configuration, fixture, provider integration, or Vercel setting was created. PR #1435 remains unchanged and on hold pending authenticated Preview infrastructure.
