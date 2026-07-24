# B4 Preview Backend Deployment Design Reconciliation

**Status:** Draft design; no implementation or cloud mutation authorized

**Scope:** `rentchain-preview` only. Production project `project-0d9658de-af29-4dc0-a99` is prohibited.

## Executive summary

The isolated Preview project already contains the Terraform-managed B4/B5 foundation: the approved workload APIs, a private Artifact Registry repository, deployment and runtime service accounts, and keyless deployment identity controls. It contains no Cloud Run service, image, datastore, secret, fixture, or Vercel backend route. This document reconciles that state and defines the minimum design for a future, separately authorized implementation.

No resources, APIs, IAM bindings, secrets, images, users, or data were created for this design. PR #1453 remains draft and unmerged.

## Current inventory and reconciliation

Read-only inventory was performed with the active identity `admin@rentchain.ai` against project `rentchain-preview` (project number `501298948635`, organization `1033579517380`). The project is active, billing-enabled, and labelled as permanent Preview.

Observed resources:

| Area | Observed state | Reconciliation result |
| --- | --- | --- |
| Artifact Registry | Private Docker repository `northamerica-northeast1/rentchain-preview`; zero images | Matches `deployment_foundation.tf`; no image delivery has occurred |
| Cloud Run | No services | Matches the current Terraform boundary |
| Service accounts | `preview-backend-runtime`, `github-preview-deploy`, HCP plan/apply identities, and the Compute default identity | Runtime account exists and is role-less; deployment identity is governed separately |
| Firestore | API disabled; no database inventory available without enabling it | No datastore exists in the approved scope |
| Secret Manager | API disabled; no secrets accessed | No secret resource exists in the approved scope |
| Storage | No application bucket observed | No storage dependency is approved |
| Terraform | Root is `infra/environments/preview-foundation`; HCP workspace is `rentchain-preview-foundation` | Read-only state listing and refresh-only plan both reconcile with GCP and repository configuration |

The repository, HCP state, and observed project agree that the backend workload is not yet deployed. No production project address appears in state or plan.

### HCP Terraform evidence

- Organization: `Rentchain`
- Workspace: `rentchain-preview-foundation`
- Current state resource count: **15**
- Read-only refresh-only run: `run-FNUUJpCEBLWSRVeL`
- Plan result: **No changes** (0 add, 0 change, 0 destroy)
- Apply/import/state mutation: none

State addresses are:

```text
google_artifact_registry_repository.preview_backend
google_artifact_registry_repository_iam_member.github_preview_image_publisher
google_iam_workload_identity_pool.github_preview_deploy
google_iam_workload_identity_pool_provider.github
google_project_iam_custom_role.github_preview_deployment_inspector
google_project_iam_custom_role.github_preview_image_publisher
google_project_iam_member.github_preview_deployment_inspector
google_project_service.approved_management["artifactregistry.googleapis.com"]
google_project_service.approved_management["cloudresourcemanager.googleapis.com"]
google_project_service.approved_management["iam.googleapis.com"]
google_project_service.approved_management["run.googleapis.com"]
google_project_service.approved_management["serviceusage.googleapis.com"]
google_service_account.github_preview_deploy
google_service_account.preview_backend_runtime
google_service_account_iam_member.github_preview_deploy_federation
```

The Artifact Registry repository and `preview-backend-runtime` service account are represented in state and match the GCP inventory. The remaining state is the approved B2/B3/B5 API, WIF, custom-role, and repository-IAM foundation. No Cloud Run, Firestore, Secret Manager, production, or application workload resource appears.

## Existing identity foundation

The B3/B4/B5 design separates identities:

- `github-preview-deploy` is the exact-main, exact-workflow, workflow-dispatch GitHub deployment identity with repository-scoped Artifact Registry publishing permission.
- `preview-backend-runtime` exists for a future Cloud Run workload and currently has no runtime data-access roles.
- HCP Terraform plan and apply identities remain phase-separated and are not Cloud Run runtime identities.
- No Vercel identity bridge is configured for this backend path.

No IAM broadening is part of this design. The future runtime account must receive only the minimum preview-datastore and secret-access roles after the datastore and secret model are separately approved.

## Backend configuration audit

The backend reads configuration through environment variables and Firebase initialization. The following classifications apply:

| Configuration | Classification for Preview |
| --- | --- |
| `PORT`, `NODE_ENV=production`, `RELEASE_SHA`, `RENTCHAIN_VERSION`, `APP_GIT_SHA`, `APP_BUILD_ID`, `APP_ENV=preview` | Safe non-secret configuration |
| `FIREBASE_PROJECT_ID` / database identifier, Firebase client configuration, preview API origin, CORS allowlist | Synthetic Preview configuration; must identify `rentchain-preview` and never production |
| `JWT_SECRET`, Firebase server credentials, encryption keys, provider webhook secrets, Stripe secrets | Preview-only secrets; never copy production values; provision through an approved secret mechanism |
| `GOOGLE_APPLICATION_CREDENTIALS` and service-account JSON keys | Prohibited; workload identity must provide credentials |
| Production Firebase project IDs, production API URLs, production provider credentials, live payment/PAD credentials | Prohibited |
| OpenAI, screening, email, payment, and external-provider integrations | Disabled unless a separate Preview-safe adapter and authorization exists |

Existing `/health` and `/api/__probe/version` surfaces provide a basis for safe identity reporting. A future implementation must add or configure a non-sensitive response containing environment, full commit SHA, build ID, image digest, revision, and deployment timestamp without secrets or tenant data.

## Datastore decision

| Option | Compatibility | Isolation | Fixture/reset | Cost/complexity | Decision |
| --- | --- | --- | --- | --- | --- |
| Firestore in Preview project | Highest application compatibility | Strong project boundary; production remains inaccessible | Deterministic synthetic seed/reset | Low-to-moderate; requires enabling API and rules/IAM | **Recommended, with a separately named database** |
| Firestore emulator/ephemeral datastore | Good for local tests; not equivalent to Cloud Run | Strong local isolation | Excellent | Low cost; does not prove deployed service behavior | Keep for automated tests, not final QA |
| Separate named Firestore database in Preview | Highest isolation within Preview and clear identity | Explicit database/project target | Supports deterministic cleanup | Moderate setup; requires application database selection | **Required form of recommended option** |
| Existing test datastore mechanism | Unknown until audited | Must prove project/database guard | Depends on mechanism | Could hide production fallback risk | Not approved without evidence |

The recommended target is a separately named Firestore database in `rentchain-preview`, with explicit project and database identifiers, synthetic-only data, deterministic fixture IDs, and a reset/cleanup operation guarded to refuse every other project. The Firestore API and database must not be enabled or created by this design PR.

## Authentication and test-user strategy

Preview QA requires a distinct Preview authentication boundary. Production Firebase/Auth configuration must not be reused. The preferred design is a dedicated Preview Firebase/Auth configuration associated with `rentchain-preview`, or an explicitly isolated emulator only for local tests. A disposable landlord account is created only through an approved seed/admin workflow after authentication infrastructure is authorized. Credentials are stored outside the repository, rotated after QA, and never logged.

No users or authentication resources are created in this design.

## Secret and configuration model

- Non-secret deployment identity and routing values belong in Cloud Run environment variables and Vercel Preview variables.
- JWT signing, Firebase server credentials, encryption, and any approved provider webhook values belong in Secret Manager only after that API and IAM are separately approved.
- Production values are never copied or used as fallbacks.
- Missing Preview configuration must fail closed at startup or return a non-sensitive readiness failure; it must not silently select production.
- The runtime service account receives secret access only to named Preview secrets, never project-wide secret administration.

## Proposed Cloud Run service (not implemented)

| Property | Proposed value |
| --- | --- |
| Service | `rentchain-preview-backend` |
| Region | `northamerica-northeast1` |
| Ingress | Internal-and-cloud-load-balancing only if required by the chosen Vercel path; otherwise authenticated direct ingress with explicit origin controls |
| Authentication | IAM/authenticated application requests; no unauthenticated mutation access |
| Runtime identity | `preview-backend-runtime@rentchain-preview.iam.gserviceaccount.com` |
| Scaling | min 0, max 1 during QA |
| Resources | Start at 1 vCPU / 512MiB; confirm from measured startup before implementation |
| Concurrency/timeout | Conservative bounded values, documented with the implementation plan |
| Probes | `/health` startup/readiness probes; safe `/api/__probe/version` identity response |
| Traffic | Single revision until exact-head QA passes; no production traffic |
| Labels | `environment=preview`, `managed-by=terraform`, full commit and build metadata |
| CORS | Exact approved Preview origin(s); reject absent or production origins |

The service must have no production datastore, provider, payment, bank, Storage, Firebase, or Secret Manager dependency unless separately approved and Preview-isolated.

## Vercel Preview integration

The preferred path is a Preview-only API base URL pointing to the authenticated Cloud Run service, with short-lived identity support and an explicit failure when the variable is absent. A Vercel server-side proxy may be preferable if browser CORS cannot be constrained safely; that choice requires a separate implementation decision. Production builds must retain their existing API base and must not inherit Preview variables.

Every frontend/backend pair must record the exact frontend commit, backend full SHA, image digest, and revision. A Preview request must never fall back to production when the Preview backend is unavailable.

## Deployment identity contract

The future deployment must expose or record all of the following:

- full Git SHA: immutable image tag and `APP_GIT_SHA`;
- image digest: deployment workflow output and safe version response;
- build ID: workflow/build metadata;
- Cloud Run revision: safe version response and service metadata;
- deployment timestamp: revision metadata and safe version response;
- environment: fixed value `preview`.

The exact PR head must be objectively comparable before functional QA. No short-SHA-only claim is sufficient.

## Disposable fixture workflow

After infrastructure authorization, a non-production seed/reset utility should create deterministic synthetic records for:

1. landlord account;
2. property;
3. unit;
4. tenant;
5. active lease;
6. active occupancy/tenancy;
7. `tenant.currentLeaseId`;
8. optional payment/ledger evidence;
9. stale-pointer and active-occupancy-without-lease negative fixtures.

The utility must require `rentchain-preview` and the named Preview database, refuse production project IDs, use fixed synthetic IDs or a disposable run namespace, emit audit-safe counts only, and support seed, reset, and cleanup. No production-data copy or fixture seeding is authorized in this design PR.

## Cost and teardown

Expected recurring cost is low but not zero: Cloud Run min-zero usage is near-zero when idle, Artifact Registry is storage-based, Firestore is usage-based, Secret Manager is per-secret/version, logging is usage-based, and Vercel Preview usage follows the existing plan. A bounded CAD 100 monthly planning ceiling exists for the project.

Teardown must remove the Cloud Run service, unneeded images, synthetic documents/database where supported, Preview secrets, test users, fixture namespace, and temporary IAM bindings. Terraform-managed foundation resources remain protected and are not destroyed by a QA cleanup. No automatic teardown or apply is introduced here.

## Implementation boundary and authorization request

The next implementation PR may proceed only after separate approval and should be split into reviewable units:

1. datastore/authentication design and isolated project configuration;
2. secret/configuration and runtime IAM;
3. Cloud Run service and deployment workflow;
4. Vercel Preview routing;
5. synthetic fixture seed/reset and exact-head QA.

Until then, the following remain blocked: Firestore/API enablement, Secret Manager, Cloud Run service creation, runtime IAM bindings, image push, Vercel variable changes, user creation, fixture seeding, and PR #1453 functional QA.

## Validation and limitations

- Repository Terraform root and safeguards were inspected.
- Project, API, service-account, Artifact Registry, and Cloud Run inventories were read-only.
- No Terraform apply, API enablement, IAM mutation, datastore access, secret access, deployment, or fixture creation occurred.
- HCP Terraform read-only state listing and refresh-only plan completed successfully: 15 resources, no changes, no production addresses.
- `git diff --check` applies to this documentation change.

## Non-goals

- No Cloud Run service, image, datastore, secret, user, fixture, Vercel variable, or IAM binding.
- No production access or data migration.
- No PR #1453 merge or deployment.
- No payment, PAD, provider, rent, deposit, or money movement changes.
