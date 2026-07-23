# Preview Foundation Terraform Root

This is the isolated Phase B Terraform root for the permanent `rentchain-preview` non-production project. It is intentionally independent from the repository-root Terraform configuration and has no production remote-state dependency. B2 manages the three approved management APIs, B3 manages the runtime-proven keyless GitHub identity, and B4 manages the private deployment repository, role-less future runtime identity, and Artifact Registry and Cloud Run APIs. B5A proposes only repository-scoped image-publisher IAM. It does not authorize or create an application workload.

## HCP Terraform mapping

- Organization: `Rentchain`
- Project: `RentChain Preview`
- Workspace: `rentchain-preview-foundation`
- Workflow: CLI-driven
- Execution mode: Remote
- State: isolated from production
- Resources/state objects: 15 applied B2/B3/B4/B5 IAM resources
- Configuration uploaded: B2, B3, B4, and B5 image-publisher IAM applied
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

The applied B3 deployment-identity foundation contains only:

- one `github-preview-deploy` Workload Identity Pool;
- one `github` OIDC provider for `https://token.actions.githubusercontent.com`;
- one `github-preview-deploy` service account with zero user-managed keys;
- one three-permission project-inspection custom role;
- one exact-subject Workload Identity User member on that service account; and
- one project IAM member granting the inspection role to that service account.

The provider requires the immutable GitHub repository ID `1103977082`, owner ID `246115482`, exact repository, exact `main` ref, `workflow_dispatch`, exact workflow file/ref, and exact branch subject. Forks, other repositories, other workflows, other events, other refs, and other subjects fail closed.

The applied B4 foundation contains only:

- `artifactregistry.googleapis.com` and `run.googleapis.com`;
- one private Docker repository named `rentchain-preview` in `northamerica-northeast1`;
- immutable Docker tags plus enforced cleanup that deletes untagged versions after seven days and keeps 15 recent versions; and
- one role-less `preview-backend-runtime` service account.

The applied B5 image-delivery IAM foundation contains only:

- one six-permission `githubPreviewImagePublisher` custom role; and
- one repository-level IAM member granting that role to the exact GitHub
  deployment service account on the existing `rentchain-preview` repository.

No Cloud Run service, image, Cloud Build resource, public IAM, Service Account User, runtime-account permission, Storage, Firebase, Firestore, secret, provider, billing, production, or runtime-data resource is proposed.

## Authentication and execution boundary

HCP Terraform uses the separately validated phase-specific plan and apply identities with short-lived workload identity credentials. The B3 GitHub deployment identity is distinct from both HCP identities and cannot be used by Terraform, Vercel, a browser, or a runtime workload.

Static credentials are prohibited. Local state must never become authoritative. Plans and applies belong only to the fixed HCP workspace. Auto-apply and auto-destroy remain off.

## Apply, drift, and destroy governance

Before any apply, capture the exact remote plan, verify the project identity and complete resource allowlist, confirm zero production or workload addresses, document cost, and obtain Founder approval for that exact plan. Plan drift is reviewed against the B1 and B2 evidence before approval.

The API resources use `prevent_destroy` and do not disable services on destroy. Removal requires a separately approved change that first documents dependencies, evidence retention, rollback impact, and the exact manual or Terraform action. No automatic destroy is permitted.

## Current classification

B2, B3, and B4 are complete. B3 runtime identity is validated, B4 is applied, and B5 image-publisher IAM is applied with exactly 15 state resources and zero drift. The manual image workflow remains unmerged and must not run before a separate exact-main-head image-push authorization. No workload deployment or B6 work is authorized, and PR #1435 remains unchanged and on hold.
