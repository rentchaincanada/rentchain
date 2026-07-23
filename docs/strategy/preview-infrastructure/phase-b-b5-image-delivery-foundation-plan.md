<!-- markdownlint-disable MD013 -->

# Phase B B5 Preview image delivery foundation

## Executive summary

B5 establishes the permanent, keyless path for one manually authorized GitHub
Actions run to build the Preview backend and upload it to the existing private
Preview Artifact Registry repository. B5B applied only one custom
image-publisher role and one repository-level member. B5C.1 corrects the
workflow so local build, inspection, and smoke validation must pass before
authentication or publication. It does not run the privileged workflow, push
an image, deploy Cloud Run, change runtime IAM, or begin B6.

The existing exact-workflow Workload Identity Federation condition remains
unchanged. To avoid changing that trusted condition or adding a third trusted
workflow, the established
`.github/workflows/preview-deployment-identity-validation.yml` path becomes the
manual image-delivery workflow. Its file path, repository, repository and owner
IDs, main ref, `workflow_dispatch` event, subject, and workflow reference remain
the exact values already validated in B3.

## Scope and boundaries

Authorized B5A work is limited to:

- repository-scoped Artifact Registry IAM design;
- a manual exact-main-head image workflow;
- bounded backend Dockerfile and build-context hardening;
- focused Terraform and static safeguards;
- an exact-head speculative Terraform plan; and
- a draft review PR.

Terraform apply, workflow execution with registry write access, image upload,
Cloud Run deployment, runtime-account delegation, public access, production,
Vercel, PR #1435, and B6 remain out of scope.

## Architecture

```text
Manual workflow_dispatch on main
  -> exact full commit SHA equals the workflow's main HEAD
  -> checkout and ancestry verification
  -> local linux/amd64 build
  -> image configuration and filesystem inspection
  -> bounded /health and /health/ready smoke validation
  -> pinned GitHub Actions
  -> GitHub OIDC
  -> exact-subject Google Workload Identity Federation
  -> github-preview-deploy service account
  -> custom role on one Artifact Registry repository
  -> backend:sha-<40-character-commit>
```

GitHub Actions is retained instead of Cloud Build because the keyless GitHub
trust path is already runtime-proven. Cloud Build would add an API, execution
identity, source-transfer mechanism, logging policy, and permission surface
without improving this bounded use case. Cloud Build remains disabled.

## Existing trust restrictions

The provider continues to require all of:

- repository `rentchaincanada/rentchain`;
- repository ID `1103977082`;
- owner `rentchaincanada`;
- owner ID `246115482`;
- ref `refs/heads/main`;
- event `workflow_dispatch`;
- workflow
  `rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main`;
- subject `repo:rentchaincanada/rentchain:ref:refs/heads/main`.

No wildcard, feature-branch, pull-request, fork, alternate workflow, or
pool-wide principal is added.

## Exact image-publisher permissions

The proposed custom role contains exactly six permissions:

| Permission | Access | Required operation | Why retained | Narrower alternative and risk |
| --- | --- | --- | --- | --- |
| `artifactregistry.repositories.get` | Read | Resolve and authenticate against the exact repository | The Docker registry client must confirm the destination repository | Cannot be replaced by a broader list permission; exposes only repository metadata |
| `artifactregistry.repositories.downloadArtifacts` | Read | Check existing blobs during the Docker push protocol | Avoids re-uploading content-addressed layers and supports registry-side blob checks | Removing it can fail the standard push flow; permits reads only within the bound repository |
| `artifactregistry.repositories.uploadArtifacts` | Write | Upload image layers and manifest | This is the core image-delivery capability | No narrower upload permission exists; risk is bounded to new artifacts in one repository |
| `artifactregistry.tags.create` | Write | Create the unique `sha-<commit>` tag | The approved workflow pushes one newly created immutable tag | Tag update/delete are excluded; risk is only new tags and repository immutability prevents movement |
| `artifactregistry.tags.get` | Read | Resolve the uploaded immutable tag during verification | The workflow verifies the tag after upload | List is excluded; exposes only the known tag |
| `artifactregistry.dockerimages.get` | Read | Inspect the exact uploaded image and digest | B5 requires independent artifact inspection after push | List is excluded; exposes only known image metadata |

The role excludes repository IAM administration, repository mutation or
deletion, artifact deletion, tag update/delete, version mutation/deletion,
package deletion, file deletion, service-account impersonation, Cloud Run,
Cloud Build, Storage, Secret Manager, Firebase, Firestore, billing, and
production permissions.

## Terraform resources

The proposed resources are:

```text
google_project_iam_custom_role.github_preview_image_publisher
google_artifact_registry_repository_iam_member.github_preview_image_publisher
```

The member binds the custom role only to
`serviceAccount:github-preview-deploy@rentchain-preview.iam.gserviceaccount.com`
on:

```text
projects/rentchain-preview/locations/northamerica-northeast1/repositories/rentchain-preview
```

The B5B apply produced exactly 15 state resources and a subsequent plan
reported zero drift. The external HCP bootstrap roles remain outside Terraform
state.

## Image naming and immutable deployment identity

The sole image path is:

```text
northamerica-northeast1-docker.pkg.dev/rentchain-preview/rentchain-preview/backend
```

The workflow accepts a full lowercase 40-character SHA and requires it to equal
the current `github.sha` for a manual dispatch on `main`. It checks out and
re-verifies that exact commit. The only tag is:

```text
sha-<full-40-character-commit>
```

No `latest`, branch, environment, stable, or production tag is created. The
workflow pushes the already validated local image, captures Docker's published
manifest digest, validates its SHA-256 shape, resolves the immutable tag
through Artifact Registry, and requires the observed digest to match. Any
future Cloud Run deployment must reference that digest rather than the tag.

## Docker build

The build uses `rentchain-api/Dockerfile` with context `rentchain-api`.
`node:20.20.2-slim` is used for separate build and runtime stages. The build
stage installs the locked complete dependency graph and compiles
`src/index.build.ts`. The runtime stage installs only production dependencies,
copies only `dist`, runs as the base image's non-root `node` user, exposes
`8080`, and starts:

```text
node dist/index.build.js
```

No build argument, environment-specific value, production secret, database
content, or runtime data is required for compilation.

The context excludes Git metadata, GitHub and handoff files, environment files,
credentials, Terraform state, dependencies, prior builds, coverage, logs,
tests, test output, editor/OS metadata, Cloud Build configuration, and temporary
files. TypeScript source, configuration, package manifests, and the lockfile
remain available for deterministic compilation.

## Workflow controls

The existing exact-trust workflow path remains manual-only. Repository
permissions are only `contents: read` and `id-token: write`. Checkout, Google
authentication, Google CLI setup, and Buildx actions are pinned to full commit
SHAs. Checkout does not persist GitHub credentials.

The workflow first checks out protected `main`, validates the full SHA, requires
it to equal the dispatch SHA and be an ancestor of that protected head, then
checks out and re-verifies the exact commit. Repository/ref/event guards
prevent privileged execution from another repository, branch, event, pull
request, or fork.

Buildx creates and loads one local `linux/amd64` image without registry
authentication. Before authentication, the workflow verifies the platform,
non-root runtime user, exact command, declared port, compiled output,
production dependency layout, prohibited paths, and high-confidence credential
patterns. It then starts the same image with only non-secret local-development
values, requires the process to remain alive, and probes `/health` and
`/health/ready` with bounded retries. Database readiness is expected to be
`skipped` because no credentials are supplied.

Only after every validation succeeds does keyless authentication occur. The
same local image is tagged once and pushed without a rebuild. Docker's digest
is compared with the remote Artifact Registry digest. Tokens, generated
credential files, and potential secret values are not printed or uploaded.

## Rollback and cleanup

Before apply, rollback is source-only: close the draft PR and delete its branch.
No cloud state changes exist.

After a separately approved IAM apply but before a push, removing the
repository member or custom role requires a new exact Terraform plan and
Founder authorization. The resources use `prevent_destroy`, so accidental
source removal fails closed.

After a separately approved push, the repository's existing cleanup policy may
delete only untagged versions older than seven days and preserves 15 recent
versions. The commit tag is immutable. Manual artifact deletion, tag deletion,
or policy changes are not authorized by B5A.

## Security and governance confirmation

- Runtime identity `preview-backend-runtime` is unchanged, role-less, keyless,
  unfederated, and unused.
- `iam.serviceAccounts.actAs` is absent.
- No predefined Artifact Registry role or project-level writer is used.
- No public IAM is introduced.
- No Cloud Run service, job, revision, or deployment is included.
- Cloud Build remains disabled and unused.
- B5B IAM is applied and zero drift is established at 15 state resources.
- No image is pushed during B5C.1.
- Production is inaccessible and unchanged.
- PR #1435 remains draft, unchanged, and on hold.
- B6 remains unstarted.

## Future B6 dependencies

A future phase may be considered only after the corrected workflow is merged to
`main`, a separately authorized exact-main-head workflow run builds, validates,
and pushes one image, digest and provenance are verified, and no Cloud Run
deployment is confirmed. This document does not authorize workflow execution,
merge, or B6.

## Plan evidence

B5B applied two approved IAM resources and established a 15-resource,
zero-drift state. Because B5C.1 adjusts a Terraform check to accept the
provider's documented short and fully qualified repository representations, a
fresh speculative zero-drift plan is required from the final corrected head.
No Terraform apply is authorized by B5C.1.
