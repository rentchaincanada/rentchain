<!-- markdownlint-disable MD013 -->

# Phase B B3 keyless Preview deployment identity plan

## Executive summary

GitHub Actions is the selected owner of future Preview backend deployment authentication. B3 proposes a dedicated GitHub OIDC to Google Workload Identity Federation path that is separate from production Cloud Build, HCP Terraform plan/apply identities, the retired Vercel spike identity, and all future runtime identities.

The applied identity is inspection-only. It can authenticate, describe `rentchain-preview`, and inspect enabled services. It cannot deploy Cloud Run, push images, run Cloud Build, mutate IAM, impersonate a runtime identity, access application data, or reach production.

Founder-authorized HCP run `run-pbmPLZcFQzN7jC5m` applied exactly the six B3 identity resources. No workload was deployed. Runtime GitHub OIDC validation remains incomplete because GitHub rejected the manual dispatch before execution: the new validation workflow is not present on the default branch while PR #1449 remains draft. B4 is not authorized, and PR #1435 remains unchanged, draft, and on hold.

## Audit findings

The merged Phase B sequence through PR #1448 establishes an isolated project, isolated HCP workspace, phase-separated keyless Terraform identities, exactly three managed service resources, and zero drift.

Repository and live-project inspection found:

- `.github/workflows/` contains CI and review automation but no backend deployment workflow;
- `rentchain-api/cloudbuild.yaml` is production-oriented, targets the production service defaults, and is not safe to reuse for Preview identity ownership;
- no Preview deployment service account exists;
- no `github-preview-deploy` pool or provider exists;
- only the HCP plan/apply service accounts and HCP pool exist in Preview;
- Artifact Registry, Cloud Build, and Cloud Run Admin APIs remain disabled;
- no Artifact Registry repository, Cloud Build trigger, Preview Cloud Run service, Storage bucket, Firebase resource, or Firestore resource exists; and
- active local Google configuration targets only `rentchain-preview` / `501298948635` as `admin@rentchain.ai`.

Production credentials, IAM, state, and resources were not inspected because production access is prohibited. No production identity is reused: the B3 service account, pool, provider, role, workflow, and state addresses are Preview-specific.

## Deployment identity source decision

GitHub Actions is preferred over Cloud Build and HCP Terraform:

- GitHub supplies short-lived OIDC claims for the exact repository and workflow invocation;
- repository, owner, event, ref, workflow, and subject restrictions are evaluated before token exchange;
- the manual workflow produces an auditable GitHub run without a static secret;
- federation can be revoked by disabling one provider or removing one service-account member;
- HCP Terraform remains the owner of durable infrastructure and IAM, not application deployment execution; and
- the current Cloud Build configuration is coupled to production defaults and would require a broader B4 build foundation.

Vercel is excluded because its permanent role is authenticated frontend-to-backend invocation, not backend deployment. The bounded spike identity was deleted and is not reused.

## Proposed identity resources

| Resource | Exact identifier | Boundary |
| --- | --- | --- |
| Workload Identity Pool | `github-preview-deploy` | Preview project only |
| OIDC provider | `github` | GitHub Actions issuer only |
| Deployment service account | `github-preview-deploy@rentchain-preview.iam.gserviceaccount.com` | Authentication and inspection only |
| Custom role | `githubPreviewDeploymentInspector` | Three non-mutating permissions |
| Federation member | Exact GitHub `main` branch subject | Service-account policy only |
| Inspection grant | Custom role to deployment service account | Preview project only |

The Terraform plan must add exactly six B3 identity resources while retaining the three existing B2 service resources unchanged.

## Issuer, audience, and attribute mapping

Issuer:

`https://token.actions.githubusercontent.com`

The provider does not add a custom audience allowlist. Google therefore requires the OIDC audience to equal the provider's full canonical resource name, with or without the HTTPS prefix. The Google authentication action uses that exact provider resource as its audience. A different audience is rejected.

Mappings:

| Google attribute | GitHub assertion |
| --- | --- |
| `google.subject` | `assertion.sub` |
| `attribute.repository` | `assertion.repository` |
| `attribute.repository_id` | `assertion.repository_id` |
| `attribute.repository_owner` | `assertion.repository_owner` |
| `attribute.repository_owner_id` | `assertion.repository_owner_id` |
| `attribute.ref` | `assertion.ref` |
| `attribute.event_name` | `assertion.event_name` |
| `attribute.job_workflow_ref` | `assertion.job_workflow_ref` |

The service-account policy member is the exact subject principal:

`principal://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/github-preview-deploy/subject/repo:rentchaincanada/rentchain:ref:refs/heads/main`

No pool-wide, provider-wide, repository-wide, organization-wide, wildcard, or project-level Workload Identity User binding is proposed.

## Attribute condition

The provider accepts a token only when all claims match:

- repository: `rentchaincanada/rentchain`;
- immutable repository ID: `1103977082`;
- repository owner: `rentchaincanada`;
- immutable owner ID: `246115482`;
- ref: `refs/heads/main`;
- event: `workflow_dispatch`;
- workflow: `rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main`; and
- subject: `repo:rentchaincanada/rentchain:ref:refs/heads/main`.

Forks cannot satisfy the immutable repository and owner claims. Pull-request events, Dependabot events, other automation, other branches, tags, reusable workflows, renamed workflow paths, and arbitrary repositories fail closed. Actor identity is not trusted as an authorization claim because repository access is the governed control and actor membership is mutable. A future deployment environment approval belongs to B4 and requires separate authorization.

## IAM role and scope

The custom role contains exactly:

- `resourcemanager.projects.get`;
- `serviceusage.services.get`; and
- `serviceusage.services.list`.

The deployment identity receives no Cloud Run, Artifact Registry, Cloud Build, IAM mutation, Service Account User, Token Creator, Storage, Firebase, Firestore, billing, secret, or production permission.

## Required API posture

The APIs needed for federation are already enabled:

- `cloudresourcemanager.googleapis.com`;
- `iam.googleapis.com`;
- `iamcredentials.googleapis.com`;
- `serviceusage.googleapis.com`; and
- `sts.googleapis.com`.

B3 proposes no API enablement. Cloud Run Admin, Artifact Registry, Cloud Build, Firebase, Firestore, and Secret Manager remain disabled.

## Validation workflow

`.github/workflows/preview-deployment-identity-validation.yml` is manual-dispatch only. It grants only `contents: read` and `id-token: write`, pins the official Google authentication and CLI setup actions to immutable commits, and fails closed unless repository, ref, and event match the approved context.

After a separately authorized apply, the workflow may:

1. exchange the GitHub OIDC token for short-lived credentials;
2. describe only the `rentchain-preview` project; and
3. list enabled services in that project.

It prints no token, uploads no credential, deploys nothing, and mutates nothing. The ephemeral credentials file created by the supported authentication action is runner-local and removed by the action cleanup step; it is not a service-account key or repository secret.

The workflow must not be dispatched before the B3 apply completes. Runtime success is not claimed in this PR.

## Negative-test plan

| Case | Proof before apply | Runtime proof after apply |
| --- | --- | --- |
| Exact trusted workflow | Terraform contract and workflow scan | Manual dispatch succeeds |
| Wrong repository or fork | Immutable repository/owner condition | Token exchange denied |
| Wrong workflow | Exact `job_workflow_ref` condition | Token exchange denied |
| Wrong ref or event | Exact ref/event/subject condition | Job guard or exchange denied |
| Missing token | Workflow permission and auth step contract | Authentication fails closed |
| Wrong audience | Default canonical-provider audience rule | STS exchange denied |
| User-managed key | Static scan prohibits key resource | Key inventory remains zero |
| Wildcard federation | Exact principal and scan | Service-account policy remains exact |
| Production access | Project validations and role scope | Production remains unqueried |
| Cloud Run deploy | No permission or resource | Permission denied; no service created |
| Artifact Registry push | No API, repository, or permission | Permission denied; no artifact created |
| IAM mutation | No IAM mutation permission | Permission denied |

This PR supplies configuration proof only. It does not manufacture a JWT or claim runtime proof before apply.

## Terraform plan evidence

The reviewed Terraform source commit is:

`4ff3f2f023ebbf7598e80b87503890d1d569abce`

The exact confirmable HCP plan is:

| Evidence | Value |
| --- | --- |
| Run | `run-pbmPLZcFQzN7jC5m` |
| Configuration version | `cv-5FvrwG2ZoeABVAnJ` |
| Plan | `plan-Gwt7aQDuvekMj4Qf` |
| Workspace | `rentchain-preview-foundation` / `ws-ebtKQ2gkLZuoRis4` |
| Status | `applied` |
| Auto-apply | Off |
| Result | `6 to add, 0 to change, 0 to destroy, 0 to import` |
| Apply | `apply-2NsX8YBNBPBdwX4L` |

The six create actions are exactly:

```text
google_iam_workload_identity_pool.github_preview_deploy
google_iam_workload_identity_pool_provider.github
google_project_iam_custom_role.github_preview_deployment_inspector
google_project_iam_member.github_preview_deployment_inspector
google_service_account.github_preview_deploy
google_service_account_iam_member.github_preview_deploy_federation
```

The existing three `google_project_service.approved_management` addresses are no-ops. Every planned resource targets `rentchain-preview`; no API, workload, billing, production, broad-IAM, key, change, destroy, or import action appears.

A preceding CLI validation run, `run-4kMm7ZhzWy1fMYgm`, produced the same six-resource plan but was speculative and non-confirmable. The previous confirmable run, `run-ccC8nZHromtvHT6i`, was discarded unapplied after the reviewed permission-evidence source superseded it. Neither run is eligible for approval or apply. No state or cloud resource resulted from either preceding run.

The Founder separately authorized only this exact run, configuration version, plan, source head, workspace, project, and six-resource create set. It applied successfully without retry, variable change, source change, or IAM broadening.

## HCP apply permission audit

The locked HashiCorp Google provider version is `6.50.0`. Its exact create paths for the six planned resources were inspected before changing IAM. The provider creates each resource and then reads it. The two IAM member resources use read-modify-write policy operations. The custom-role create path also reads the requested role ID first so it can distinguish absence from a soft-deleted role.

The target pool, deployment service account, and deployment-inspector role were independently confirmed absent before the permission change. That absence makes update and undelete branches inapplicable to this exact plan. Provider source inspection found no list call in any exact create/read path.

The existing four apply permissions are preserved. The exact 12-permission addition is:

- `iam.googleapis.com/workloadIdentityPools.create`;
- `iam.googleapis.com/workloadIdentityPools.get`;
- `iam.googleapis.com/workloadIdentityPoolProviders.create`;
- `iam.googleapis.com/workloadIdentityPoolProviders.get`;
- `iam.serviceAccounts.create`;
- `iam.serviceAccounts.get`;
- `iam.serviceAccounts.getIamPolicy`;
- `iam.serviceAccounts.setIamPolicy`;
- `iam.roles.create`;
- `iam.roles.get`;
- `resourcemanager.projects.getIamPolicy`; and
- `resourcemanager.projects.setIamPolicy`.

The resulting custom role has exactly the 16 permissions recorded in `infra/environments/preview-foundation/tests/hcp_apply_permissions.txt`. The administrative update changed only `projects/rentchain-preview/roles/hcpTerraformPreviewApply`; it added no predefined role, binding, service account, federation member, or Terraform state resource.

| Terraform resource | Permission | Purpose and phase | Scope | Residual privilege and narrower-alternative assessment |
| --- | --- | --- | --- | --- |
| `google_iam_workload_identity_pool` | `iam.googleapis.com/workloadIdentityPools.create`, `iam.googleapis.com/workloadIdentityPools.get` | Create and post-create read during apply | `rentchain-preview`, global location | Can create/read another pool in Preview while the apply-phase credential exists. IAM cannot restrict these permissions to one future pool ID; exact HCP trust, exact plan review, and manual confirmation are the operational boundary. |
| `google_iam_workload_identity_pool_provider` | `iam.googleapis.com/workloadIdentityPoolProviders.create`, `iam.googleapis.com/workloadIdentityPoolProviders.get` | Create and post-create read during apply | `github-preview-deploy` pool in `rentchain-preview` | Can create/read another provider under a Preview pool. No narrower custom-role permission exists; exact-plan review is required. |
| `google_service_account` | `iam.serviceAccounts.create`, `iam.serviceAccounts.get` | Create and post-create read during apply | `rentchain-preview` | Can create/read another Preview service account. Key, token, signing, update, disable, and delete permissions remain absent. |
| `google_service_account_iam_member` | `iam.serviceAccounts.getIamPolicy`, `iam.serviceAccounts.setIamPolicy` | Read-modify-write the new service account policy during apply | Preview service accounts | Policy setters are sensitive and cannot be constrained to the future account in a project custom role. The exact plan must contain only the exact-subject Workload Identity User member. |
| `google_project_iam_custom_role` | `iam.roles.get`, `iam.roles.create` | Absence check, create, and post-create read during apply | Project custom roles in `rentchain-preview` | Can create another Preview project role, but cannot update, delete, or undelete one. Exact-plan review is the narrowest available operational constraint. |
| `google_project_iam_member` | `resourcemanager.projects.getIamPolicy`, `resourcemanager.projects.setIamPolicy` | Read-modify-write the Preview project policy during apply | `rentchain-preview` project | This pair can modify Preview project IAM and is the largest residual capability. Google exposes no role-specific setter for this Terraform resource. It is permitted only for the phase-restricted apply identity and a manually confirmed exact plan. |
| Existing B2 services | `resourcemanager.projects.get`, `serviceusage.services.get`, `serviceusage.services.list`, `serviceusage.services.enable` | Preserve existing project and managed-service apply behavior | `rentchain-preview` project | No new API is planned by B3; these permissions are unchanged from B2. |

List, update, delete, and undelete permissions are excluded because provider 6.50.0 does not invoke them for the exact absent-resource create path. They would be required only for a separately reviewed configuration update or rollback. The plan identity remains unchanged. A later zero-drift plan after B3 creation may require a separately authorized read-only plan-role expansion; this apply-role mission does not grant it pre-emptively.

Explicitly absent permissions include service-account key creation or upload, access-token generation, signing, Cloud Run, Artifact Registry, Cloud Build, Storage, Firebase, Firestore, billing, organization IAM, project deletion, production access, and all B3 update/delete/undelete operations. No broad predefined role is granted.

## Post-apply evidence

HCP reported the exact run as `applied` with apply ID `apply-2NsX8YBNBPBdwX4L`. The apply-phase keyless identity authenticated successfully at runtime. Terraform state now contains exactly nine resources: the three existing B2 services and the six authorized B3 addresses. No additional address entered state.

Live Google Cloud verification confirmed:

- pool `github-preview-deploy` is active;
- provider `github` is active and uses issuer `https://token.actions.githubusercontent.com`;
- provider mappings remain limited to subject, repository, immutable repository ID, repository owner, immutable owner ID, ref, event, and workflow reference;
- the provider condition fixes repository `rentchaincanada/rentchain`, repository ID `1103977082`, owner `rentchaincanada`, owner ID `246115482`, ref `refs/heads/main`, event `workflow_dispatch`, the exact validation workflow on `main`, and the exact main-branch subject;
- service account `github-preview-deploy@rentchain-preview.iam.gserviceaccount.com` exists with zero user-managed keys;
- its only federation member is the exact main-branch subject principal with `roles/iam.workloadIdentityUser` on that service account;
- no project-level Workload Identity User binding exists;
- custom role `githubPreviewDeploymentInspector` contains only `resourcemanager.projects.get`, `serviceusage.services.get`, and `serviceusage.services.list`;
- the custom role is bound only to the deployment service account in `rentchain-preview`;
- HCP plan and apply service accounts retain zero user-managed keys;
- Cloud Run, Artifact Registry, Cloud Build, Firebase, and Firestore workload APIs remain disabled or absent; and
- Storage buckets remain zero.

The single authorized manual workflow dispatch targeted `main`. GitHub rejected it with HTTP 404 because `preview-deployment-identity-validation.yml` is not on the default branch. No workflow job started, no GitHub OIDC token was requested, no credential exchange occurred, and no runtime or negative OIDC test executed. The provider condition was not weakened and the dispatch was not retried.

The mission required an immediate stop after runtime validation failure. Therefore no post-apply HCP plan was generated. No missing plan-role read permission was observed because refresh was not attempted. Zero-drift remains unproven and requires a later, separately authorized sequence after the workflow becomes available on the default branch.

## Cost impact

Workload Identity Federation, service accounts, and IAM policy configuration have no expected direct incremental charge. One manually dispatched validation workflow consumes a small amount of GitHub Actions time. No billable workload or storage is created. Expected incremental Google Cloud cost is approximately CAD 0.

## Audit and revocation

Evidence consists of the exact Terraform configuration/version/run/plan, state inventory, GitHub workflow run, provider condition, service-account policy, custom-role permissions, zero-key inventory, enabled-service inventory, and zero-drift plan. Tokens and credential files must never be retained.

Before apply, revocation is achieved by discarding the HCP run. After apply, emergency access revocation disables the provider or removes the exact service-account federation member. Full rollback requires separate authorization and proceeds in reverse order:

1. disable or remove the validation workflow;
2. remove the exact service-account federation member;
3. remove the project inspection-role member;
4. delete the deployment service account;
5. delete the custom inspection role;
6. delete the OIDC provider; and
7. delete the Workload Identity Pool.

Any B3-only API removal would require a dependency review, but B3 proposes no API addition. Terraform `prevent_destroy` guards require an explicitly reviewed rollback change before destruction.

## Blockers and approval boundary

- The fresh exact HCP plan passed and applied only the six proposed B3 resources.
- The previous exact HCP run was discarded unapplied and is not eligible for apply approval.
- The HCP apply custom role expansion is an external administrative prerequisite, not a Terraform-managed B3 resource. It must remain exact, apply-phase restricted, and bound only to `hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com` on `rentchain-preview`.
- Runtime validation is blocked until the approved workflow exists on the default branch. No alternate ref, temporary workflow, condition relaxation, or rerun is authorized.
- Zero-drift validation was not attempted after the runtime stop condition.
- Future authorization must decide the safe ordering between merging the evidence/configuration PR and executing the main-only validation workflow.
- B4 deployment permissions and workload resources remain separately unauthorized.

## Classification

**B3 applied; validation incomplete.** The exact six-resource identity apply succeeded and state contains nine expected resources, but GitHub OIDC runtime validation and post-apply zero-drift validation remain incomplete. Neither full identity-foundation validation nor a missing-read-permission classification can be claimed yet.

No workload was deployed. B4 did not begin. PR #1435 remains unchanged, draft, and on hold.
