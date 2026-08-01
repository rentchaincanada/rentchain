# Production Cloud Build build-only identity plan

## Current boundary

External trigger `07c21dce-42db-4d5f-89d4-616534f27e4f` uses `rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com`. Its project roles include Cloud Run Admin, Cloud Build Editor, project-wide Artifact Registry Writer, project-wide Service Account User, Storage Admin, Logs Writer, and Service Usage Consumer. Those grants substantially exceed the corrected automatic pipeline, which validates the backend, builds one image, pushes it to the existing `rentchain-api` repository, writes Cloud Logging entries, and stops.

The trigger is externally managed. Production HCP workspace `rentchain` (`ws-1dXGdYNdZhQh3RpV`) manages an older `rentchain-api` repository in `northamerica-northeast1`, while the corrected build uses a distinct existing `rentchain-api` repository in `us-central1`. The target repository and trigger are not in HCP state. This change manages only a new IAM member on the exact `us-central1` repository plus the new identity, custom role, and logging member; it does not import or take ownership of either repository, the external trigger, or the existing deployer.

## Dedicated identity

The proposed account is:

```text
rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com
```

It receives `roles/logging.logWriter` at the Production project because the build uses `CLOUD_LOGGING_ONLY`. It receives a custom Artifact Registry role only on:

```text
projects/project-0d9658de-af29-4dc0-a99/locations/us-central1/repositories/rentchain-api
```

The custom role contains exactly:

| Permission | Required operation |
| --- | --- |
| `artifactregistry.repositories.get` | Resolve the approved repository |
| `artifactregistry.repositories.downloadArtifacts` | Check existing content-addressed layers during push |
| `artifactregistry.repositories.uploadArtifacts` | Upload image layers and manifest |
| `artifactregistry.tags.create` | Create the immutable `sha-<commit>` tag |
| `artifactregistry.tags.get` | Resolve the exact uploaded tag |
| `artifactregistry.dockerimages.get` | Inspect the exact image and digest |

No source or logs bucket is configured. The successful build fetched the exact GitHub revision directly, used the default worker pool, emitted logs only to Cloud Logging, and recorded no secrets, KMS key, private pool, attestation, or user bucket. Base images are public Docker Hub and Google Cloud Builder images pulled by the build platform. No Storage role is proposed.

No Cloud Build Editor or Builder role is proposed for the execution identity: the Cloud Build control plane runs the configured steps, while the identity needs only permissions exercised inside those steps. The existing Cloud Build service agent retains its platform-managed service-agent role. The current deployer has no service-account IAM-policy binding, and its successful build used no key or explicit token-minting binding; therefore no Workload Identity User, Token Creator, or project-wide Service Account User grant is proposed.

## Forbidden authority

The build-only identity receives no Cloud Run, traffic, IAM administration, trigger administration, Artifact Registry administration or deletion, Storage, Secret Manager, Firebase, Firestore, Identity Platform, service-account impersonation, key-creation, Terraform, or Vercel authority. It remains distinct from the separately governed candidate-deployment and promotion identities.

## Governed migration

1. Review the Terraform plan for only the new service account, custom role, repository-scoped member, and Logs Writer member.
2. Separately authorize and apply those additive resources.
3. Separately authorize a test build that explicitly uses the new identity against an approved main SHA.
4. Verify backend validation, immutable image push, digest metadata, and Cloud Logging output.
5. Verify no Cloud Run revision, traffic, IAM, Secret Manager, Terraform, Firebase, Firestore, Identity Platform, or Vercel mutation.
6. Separately authorize updating only the external trigger service-account field to the new account. Keep `^main$`, `rentchain-api/**`, and `rentchain-api/cloudbuild.yaml` unchanged.
7. Verify one main-triggered build and the unchanged Production service revision/traffic baseline.
8. If the test or trigger build fails, restore the trigger service-account field to `rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com`. Do not delete the new identity automatically.
9. Retain the old deployer until all other dependencies are reviewed. Remove its obsolete automatic-build rights only through a separate subtractive IAM change; do not assume it is unused by legacy operations.

The trigger operator must already have `iam.serviceAccounts.actAs` on the new account when performing the separately authorized switch. This plan does not add a persistent impersonation binding and does not modify the trigger.

## Separately authorized commands

After the additive Terraform apply is reviewed and separately authorized, check out the exact approved main SHA and run one build explicitly as the new identity:

```bash
git checkout --detach <APPROVED_FULL_MAIN_SHA>

gcloud builds submit . \
  --config=rentchain-api/cloudbuild.yaml \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --service-account=projects/project-0d9658de-af29-4dc0-a99/serviceAccounts/rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com \
  --substitutions=COMMIT_SHA=<APPROVED_FULL_MAIN_SHA>
```

After verifying the build, immutable digest, logs, and unchanged Cloud Run revision/traffic state, separately authorize the external trigger switch:

```bash
gcloud builds triggers update github \
  07c21dce-42db-4d5f-89d4-616534f27e4f \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --service-account=projects/project-0d9658de-af29-4dc0-a99/serviceAccounts/rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com
```

Verify the trigger identity without changing it again:

```bash
gcloud builds triggers describe \
  07c21dce-42db-4d5f-89d4-616534f27e4f \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --format='value(serviceAccount)'
```

If the governed test fails, separately authorize rollback of only the trigger identity:

```bash
gcloud builds triggers update github \
  07c21dce-42db-4d5f-89d4-616534f27e4f \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --service-account=projects/project-0d9658de-af29-4dc0-a99/serviceAccounts/rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com
```

Do not delete the new account or remove old deployer rights as part of rollback.

## Evidence and audit

The separately authorized test must record the build ID, source SHA, trigger or explicit build context, immutable image digest, step statuses, principal email, and timestamps. Cloud Audit Logs must show only expected Cloud Build, Artifact Registry upload/read, and Logging operations by the new identity. Preserve the old and new IAM snapshots, trigger snapshots, build logs, Production revision/traffic snapshots, and rollback decision as review evidence.

This preparation performs no IAM change, trigger update, build submission, deployment, traffic change, Terraform apply, or cleanup.
