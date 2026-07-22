<!-- markdownlint-disable MD013 -->

# Phase B B3 keyless Preview deployment identity plan

## Executive summary

GitHub Actions is the selected owner of future Preview backend deployment authentication. B3 proposes a dedicated GitHub OIDC to Google Workload Identity Federation path that is separate from production Cloud Build, HCP Terraform plan/apply identities, the retired Vercel spike identity, and all future runtime identities.

The proposed identity is inspection-only. It can authenticate, describe `rentchain-preview`, and inspect enabled services. It cannot deploy Cloud Run, push images, run Cloud Build, mutate IAM, impersonate a runtime identity, access application data, or reach production.

No workload is deployed by this change. Terraform apply remains blocked until the Founder separately approves the exact HCP run. B4 is not authorized, and PR #1435 remains unchanged, draft, and on hold.

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

To be recorded after the exact HCP plan is generated. The expected change is six additions, zero changes, and zero destroys. Any API, workload, billing, production, broad-IAM, key, change, destroy, or import action blocks B3.

No apply is authorized by this document or PR.

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

- The exact HCP plan must pass and contain only the six proposed B3 resources.
- The HCP apply identity requires separately verified least-privilege permissions for those exact resource types before an apply can be authorized.
- Founder approval must name the exact immutable HCP run and configuration version.
- Runtime validation and negative runtime evidence occur only after apply.
- B4 deployment permissions and workload resources remain separately unauthorized.

## Classification

Pending exact-plan verification: **B3 awaiting controlled apply** if the plan matches; otherwise **B3 identity requires revision** or **B3 blocked**.

No workload was deployed. B4 did not begin. PR #1435 remains unchanged, draft, and on hold.
