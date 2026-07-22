# Preview Foundation Terraform Root

This is the isolated Phase B Terraform root for the permanent `rentchain-preview` non-production project. It is intentionally independent from the repository-root Terraform configuration and has no production remote-state dependency. B2 manages only the three approved management APIs. B3 proposes a separate GitHub Actions keyless inspection identity; it does not authorize or create an application workload.

## HCP Terraform mapping

- Organization: `Rentchain`
- Project: `RentChain Preview`
- Workspace: `rentchain-preview-foundation`
- Workflow: CLI-driven
- Execution mode: Remote
- State: isolated from production
- Resources/state objects: three B2 management-service resources
- Configuration uploaded: B2 applied; B3 plan requires separate review and exact-run approval
- VCS connection: none
- Google credentials: none
- Production-state connection: none
- Auto-apply: off
- Auto-destroy: off
- Apply and destroy authority: Founder — Paul, with explicit confirmation

The cloud block fixes the organization and workspace. Project variables have no defaults, and validations bind the root to project `rentchain-preview`, project number `501298948635`, and environment `preview`. The production project `project-0d9658de-af29-4dc0-a99` is explicitly denied.

## Managed and proposed resources

The completed B2 apply manages only three `google_project_service` resources:

| API | B2 purpose | Owner | Expected direct cost | Retention decision |
| --- | --- | --- | --- | --- |
| Cloud Resource Manager | Validate and manage the bounded project target | Founder — Paul | No direct enablement charge | Retain while Terraform manages the foundation |
| Service Usage | Manage the explicit service allowlist | Founder — Paul | No direct enablement charge | Retain while Terraform manages APIs |
| Identity and Access Management | Foundation prerequisite for later separately authorized keyless identity work | Founder — Paul | No direct enablement charge | Retain pending later identity authorization |

IAM Credentials and Security Token Service were enabled during the separately governed keyless HCP identity bootstrap and remain enabled. B3 does not add or enable APIs.

The proposed B3 deployment-identity foundation contains only:

- one `github-preview-deploy` Workload Identity Pool;
- one `github` OIDC provider for `https://token.actions.githubusercontent.com`;
- one `github-preview-deploy` service account with zero user-managed keys;
- one three-permission project-inspection custom role;
- one exact-subject Workload Identity User member on that service account; and
- one project IAM member granting the inspection role to that service account.

The provider requires the immutable GitHub repository ID `1103977082`, owner ID `246115482`, exact repository, exact `main` ref, `workflow_dispatch`, exact workflow file/ref, and exact branch subject. Forks, other repositories, other workflows, other events, other refs, and other subjects fail closed.

All workload, data, build, registry, secret, messaging, compute, and Firebase services remain outside this root. B3 grants no Cloud Run, Artifact Registry, Cloud Build, IAM mutation, Service Account User, Token Creator, Storage, Firebase, or production permission.

## Authentication and execution boundary

HCP Terraform uses the separately validated phase-specific plan and apply identities with short-lived workload identity credentials. The B3 GitHub deployment identity is distinct from both HCP identities and cannot be used by Terraform, Vercel, a browser, or a runtime workload.

Static credentials are prohibited. Local state must never become authoritative. Plans and applies belong only to the fixed HCP workspace. Auto-apply and auto-destroy remain off.

## Apply, drift, and destroy governance

Before any apply, capture the exact remote plan, verify the project identity and complete resource allowlist, confirm zero production or workload addresses, document cost, and obtain Founder approval for that exact plan. Plan drift is reviewed against the B1 and B2 evidence before approval.

The API resources use `prevent_destroy` and do not disable services on destroy. Removal requires a separately approved change that first documents dependencies, evidence retention, rollback impact, and the exact manual or Terraform action. No automatic destroy is permitted.

## Current classification

B2 controlled apply is complete. B3 code and exact-plan review are authorized, but B3 apply is not. No workload deployment is authorized, B4 has not begun, and PR #1435 remains unchanged and on hold pending authenticated Preview infrastructure.
