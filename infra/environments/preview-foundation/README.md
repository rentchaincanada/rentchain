# Preview Foundation Terraform Root

This is the isolated Phase B B2 Terraform root for the permanent `rentchain-preview` non-production project. It is intentionally independent from the repository-root Terraform configuration and has no production remote-state dependency.

## HCP Terraform mapping

- Organization: `Rentchain`
- Project: `RentChain Preview`
- Workspace: `rentchain-preview-foundation`
- Workflow: CLI-driven
- Execution mode: Remote
- State: isolated from production
- Resources/state objects: zero
- Configuration uploaded: none
- VCS connection: none
- Google credentials: none
- Production-state connection: none
- Auto-apply: off
- Auto-destroy: off
- Apply and destroy authority: Founder — Paul, with explicit confirmation

The cloud block fixes the organization and workspace. Project variables have no defaults, and validations bind the root to project `rentchain-preview`, project number `501298948635`, and environment `preview`. The production project `project-0d9658de-af29-4dc0-a99` is explicitly denied.

## Proposed resources

No resource has been applied. A future explicitly approved B2 apply would manage only three `google_project_service` resources:

| API | B2 purpose | Owner | Expected direct cost | Retention decision |
| --- | --- | --- | --- | --- |
| Cloud Resource Manager | Validate and manage the bounded project target | Founder — Paul | No direct enablement charge | Retain while Terraform manages the foundation |
| Service Usage | Manage the explicit service allowlist | Founder — Paul | No direct enablement charge | Retain while Terraform manages APIs |
| Identity and Access Management | Foundation prerequisite for later separately authorized keyless identity work | Founder — Paul | No direct enablement charge | Retain pending later identity authorization |

IAM Credentials and Security Token Service are excluded because no keyless Terraform identity is authorized in B2. All workload, data, build, registry, secret, messaging, compute, and Firebase services remain outside this root.

## Authentication and execution boundary

No Google credentials, service account, IAM binding, Workload Identity pool/provider, key, or environment-derived fallback is configured. HCP Terraform therefore cannot complete remote initialization, provider-backed validation, planning, or apply until a separately authorized keyless planning identity exists.

The preferred future authentication model is HCP Terraform workload identity → Google Workload Identity Federation → a narrowly scoped Preview Terraform planning/apply identity → short-lived credentials. That path is a separate mission and is not implemented here. Service-account JSON keys, production credentials, wildcard federation, production project access, and automatic apply are prohibited.

Static credentials are prohibited. Local state must never become authoritative. Plans and applies belong only to the fixed HCP workspace. Auto-apply and auto-destroy remain off.

## Apply, drift, and destroy governance

Before any apply, capture the exact remote plan, verify the project identity and three-resource allowlist, confirm zero production or workload addresses, document cost, and obtain Founder approval for that exact plan. Plan drift is reviewed against the B1 evidence before approval.

The API resources use `prevent_destroy` and do not disable services on destroy. Removal requires a separately approved change that first documents dependencies, evidence retention, rollback impact, and the exact manual or Terraform action. No automatic destroy is permitted.

## Current classification

B2 is awaiting a controlled keyless Terraform identity. B3 is not authorized. PR #1435 remains unchanged and on hold pending authenticated Preview infrastructure.
