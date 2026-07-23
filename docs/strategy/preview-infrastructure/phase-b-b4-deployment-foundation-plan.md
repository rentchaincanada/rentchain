<!-- markdownlint-disable MD013 -->

# Phase B B4 Preview deployment foundation

## Executive summary

B4 selects the direct build path:

```text
GitHub Actions
  -> exact-subject keyless GitHub deployment identity
  -> private Artifact Registry repository
  -> separately authorized future Cloud Run deployment
```

This is simpler and safer than reusing the production Cloud Build path. It avoids a Cloud Build API, build service account, source archive, build trigger, logging policy, and additional cross-service IAM surface. B4 is infrastructure-only validation: it proposes no image push, Cloud Run service, revision, application workload, public access, runtime configuration, secret, database, fixture, Vercel change, or provider integration.

The proposed Terraform delta is four resources: two explicitly allowlisted APIs, one private Docker repository, and one role-less future runtime service account. The plan is not authorized for apply. B5 remains unauthorized, and PR #1435 remains unchanged, draft, and on hold.

## Audit inputs

The audit reviewed merged PRs #1441 through #1450, the isolated Preview Terraform root, the exact GitHub OIDC validation workflow, production and backend Dockerfiles, both production Cloud Build configurations, the production Terraform root, image names, service identities, environment/secret expectations, and current Preview evidence.

Live verification before implementation confirmed:

- active account `admin@rentchain.ai`;
- active project `rentchain-preview` / `501298948635`;
- HCP state contains exactly nine B2/B3 resources;
- `artifactregistry.googleapis.com`, `run.googleapis.com`, and `cloudbuild.googleapis.com` are disabled;
- no Preview Artifact Registry repository exists;
- no Preview Cloud Run service or revision can exist while its API is disabled;
- no Preview Cloud Build trigger can exist while its API is disabled;
- no `preview-backend-runtime` account exists;
- the only custom service accounts are the phase-separated HCP identities and exact-subject GitHub inspection identity; and
- no application workload is represented in Terraform state.

Default Google services visible in the project are not B4 workload authorization. B4 does not add Firebase, Firestore, Storage, Secret Manager, Pub/Sub, Eventarc, Cloud Functions, GKE, Compute Engine, or provider-specific APIs.

## Production non-reuse decision

Production deployment assets are evidence only and must not be reused:

| Production asset | Preview decision |
| --- | --- |
| Root and backend Cloud Build configurations | Not reused; one deploys publicly and both add Cloud Build complexity |
| Production Artifact Registry repository and image names | Not reused or mirrored |
| Production Cloud Run service | Not referenced, imported, inspected, or reused |
| Production service account and IAM | Not referenced or granted |
| Production environment variables and secrets | Not copied or accessed |
| Production Terraform state | No dependency or remote-state access |

The Preview root stays fixed to `rentchain-preview`, project number `501298948635`, environment `preview`, and HCP workspace `rentchain-preview-foundation`. The production project denylist remains fail-closed.

## Selected build architecture

GitHub Actions will eventually build directly and push to Artifact Registry using the existing exact-subject keyless GitHub identity. Cloud Build has no material advantage for the bounded Preview requirement: the repository already has a runtime-proven GitHub OIDC path, while Cloud Build would require another API, execution identity, logging model, source transport path, and operational owner.

B4 does not make that identity a writer and adds no build or deployment workflow. A harmless validation image may be considered only in a separate exact-run authorization after the foundation is applied and independently verified.

## Proposed Terraform resources

| Address | Purpose | B4 boundary |
| --- | --- | --- |
| `google_project_service.approved_management["artifactregistry.googleapis.com"]` | Enable the private image registry API | No image upload |
| `google_project_service.approved_management["run.googleapis.com"]` | Prerequisite for separately authorized future deployment tooling | No service or revision |
| `google_artifact_registry_repository.preview_backend` | Private exact-head Preview backend image repository | Empty on creation |
| `google_service_account.preview_backend_runtime` | Future backend runtime identity | Zero roles and zero keys |

No Cloud Run, Cloud Build, Storage, Firebase, Firestore, Vercel, public-IAM, billing, application, or provider resource is proposed.

## API allowlist

The Terraform-managed allowlist becomes exactly:

```text
artifactregistry.googleapis.com
cloudresourcemanager.googleapis.com
iam.googleapis.com
run.googleapis.com
serviceusage.googleapis.com
```

Only Artifact Registry and Cloud Run are B4 additions. Cloud Build remains disabled.

## Artifact Registry policy

| Setting | Value |
| --- | --- |
| Project | `rentchain-preview` |
| Repository ID | `rentchain-preview` |
| Location | `northamerica-northeast1` |
| Format | Docker |
| Access | Private by default; no IAM member is added |
| Cross-project writer | None |
| Production mirroring | Prohibited |
| Untagged cleanup | Delete after seven days |
| Recent-version retention | Keep 15 most recent versions per package |
| Cleanup enforcement | Enabled, not dry-run |
| Destroy posture | `prevent_destroy` |

Future exact-head images should use immutable commit-SHA tags and record their digest. Tags associated with actively reviewed PRs should be retained within the 15-version bound where operationally feasible. No application image is pushed in B4.

## Runtime service account

The proposed `preview-backend-runtime@rentchain-preview.iam.gserviceaccount.com` account is a dedicated future runtime identity. It receives:

- no project role;
- no service-account IAM binding;
- no GitHub or Vercel federation;
- no Service Account User delegation;
- no deployment, IAM mutation, Firebase, Firestore, Storage, Secret Manager, provider, billing, or production permission; and
- no user-managed key.

Any future role or deployment-time impersonation requires separate B5 authorization.

## Deployment identity permissions

The existing GitHub deployment identity remains inspection-only in B4:

```text
resourcemanager.projects.get
serviceusage.services.get
serviceusage.services.list
```

B4 adds no Artifact Registry writer, Cloud Run developer/admin, Service Account User, Token Creator, Cloud Build, Storage, IAM administration, or project-wide role. It cannot upload an image or deploy a service after this plan.

## HCP apply permission analysis

The current apply role already includes the exact capabilities needed to enable allowlisted services and create/read the runtime account:

| Terraform operation | Existing permission | Access | Target |
| --- | --- | --- | --- |
| Add the two allowlisted APIs | `serviceusage.services.enable` | Write | `rentchain-preview` services only |
| Refresh enabled services | `serviceusage.services.get`, `serviceusage.services.list` | Read | `rentchain-preview` only |
| Create runtime account | `iam.serviceAccounts.create` | Write | `rentchain-preview` only |
| Read runtime account | `iam.serviceAccounts.get` | Read | `rentchain-preview` only |

Artifact Registry requires a separately reviewed apply-role delta:

| Terraform resource | Proposed permission | Access | Target | Reason |
| --- | --- | --- | --- | --- |
| `google_artifact_registry_repository.preview_backend` | `artifactregistry.repositories.create` | Write | Repository `rentchain-preview` in `northamerica-northeast1` | Create the one approved repository |
| Same | `artifactregistry.repositories.get` | Read | Same repository | Read the created resource and complete apply refresh |

These two permissions are proposed, not granted. Artifact Registry Admin, repository update/delete, IAM-policy mutation, project-wide writer, Cloud Run, Cloud Build, Storage, key, token, signing, billing, and production permissions remain forbidden. Repository cleanup policies are submitted as part of repository creation; any later policy mutation or destroy requires separate authorization.

## HCP plan read-permission considerations

The current plan identity can refresh the nine existing B2/B3 resources and read the proposed service-account shape. After a future apply, zero-drift refresh of the repository is expected to require `artifactregistry.repositories.get`. That plan-role addition is not made automatically in B4.

If the controlled plan reports a new denial, planning stops without retry or permission expansion. If a later post-apply plan reports a denial, it must be returned for bounded review.

## Cost and retention

API enablement and a role-less service account have no direct charge. No Cloud Run service means zero B4 compute cost. An empty repository has no stored artifact bytes.

Google currently provides the first 0.5 GiB-month of Artifact Registry storage per billing account at no charge and prices storage beyond that threshold by GiB-hour; billing-account aggregation and currency conversion apply. See [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing). This plan assumes no image push, so expected idle B4 incremental cost is approximately CAD 0.

Operational thresholds:

- cleanup runs under the managed Artifact Registry policy;
- untagged versions older than seven days are eligible for deletion;
- only 15 recent versions per package are retained;
- storage above 5 GiB or estimated incremental spend above CAD 5/month is abnormal and requires Founder review; and
- the total Preview environment must remain under the approved CAD 100 monthly ceiling.

## Security review

Focused Terraform and static tests must prove:

- exact Preview project, number, environment, and Montréal region;
- exact Docker repository and bounded cleanup;
- absence of public or cross-project access;
- role-less runtime identity;
- absence of Service Account User;
- absence of Cloud Run service/revision and Cloud Build resources;
- exact five-API Terraform allowlist;
- absence of application image, workload, Storage, Firebase, Firestore, Vercel, provider, billing, and production resources;
- absence of static credentials and service-account keys; and
- unchanged exact-subject GitHub federation and phase-separated HCP identities.

## Rollback

Before apply, rollback is source-only: close the draft PR and delete the feature branch. No cloud resource changes have occurred.

After any separately authorized apply, `prevent_destroy` and non-disabling API behavior intentionally prevent automatic destructive rollback. Disabling APIs, deleting the repository, deleting the runtime account, changing cleanup policy, or removing evidence requires a separate dependency audit and exact Founder authorization. Images must never be deleted implicitly as part of source rollback.

## Controlled plan evidence

The exact HCP configuration version, run, plan, source commit, resource addresses, and action summary will be recorded here after local validation and one controlled plan. The plan must remain unapplied.

## Acceptance and next boundary

B4 may be classified **awaiting controlled apply** only if:

- the single HCP plan completes;
- it proposes only the four approved B4 resources;
- no workload, image, public IAM, or production action appears; and
- all repository checks pass.

The apply role permission delta remains a separate review gate. No apply, image validation, deployment permission, B5 work, or PR #1435 change is authorized by this document.
