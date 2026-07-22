<!-- markdownlint-disable MD013 -->

# Phase B B3 Preview identity runtime-validation evidence

## Executive summary

The B3 GitHub Actions to Google Workload Identity Federation path is runtime-proven for the approved read-only Preview inspection workflow. The single manual run authenticated successfully, described `rentchain-preview`, and listed its enabled services. No credential material or workflow artifact was exposed.

The post-apply HCP Terraform plan did not reach drift evaluation because the phase-separated plan identity lacks three observed read-only permissions for B3 resources. No IAM change, retry, apply, state change, workload, or API enablement followed. Final classification: **B3 runtime identity validated; zero-drift requires bounded read revision**.

This evidence extends the merged [B3 keyless deployment identity plan](./phase-b-b3-keyless-deployment-identity-plan.md). B4 remains unstarted, and PR #1435 remains unchanged, draft, and on hold.

## Merged B3 source

| Evidence | Value |
| --- | --- |
| Merged PR | `#1449` |
| Exact PR head | `85451ffad235edfd90e29769360e18da8f02d866` |
| Merge commit and validation source | `1a1144aec05c2f46561cb9c5f96dd16f130fcceb` |
| Workflow | `.github/workflows/preview-deployment-identity-validation.yml` |
| Terraform root | `infra/environments/preview-foundation` |
| Target | `rentchain-preview` / `501298948635` |

The workflow is manual `workflow_dispatch` only, grants `contents: read` and `id-token: write`, and runs only for `rentchaincanada/rentchain` on `refs/heads/main`. It invokes no deployment, image push, Cloud Build, IAM mutation, infrastructure mutation, production operation, credential upload, or token-output step.

## Runtime workflow evidence

| Evidence | Value |
| --- | --- |
| Run ID | `29925203036` |
| Workflow | `Preview deployment identity validation` |
| Path | `.github/workflows/preview-deployment-identity-validation.yml` |
| Source commit | `1a1144aec05c2f46561cb9c5f96dd16f130fcceb` |
| Event | `workflow_dispatch` |
| Ref | `main` / `refs/heads/main` |
| Actor | `rentchaincanada` |
| Created and started | `2026-07-22T13:43:36Z` |
| Completed | `2026-07-22T13:43:52Z` |
| Final result | `success` |

The authentication step, Google Cloud CLI setup, Preview inspection step, and authentication cleanup step all succeeded. The safe workflow output confirmed project `rentchain-preview` with project number `501298948635`, then successfully listed enabled services including the three Terraform-managed management services.

The supported authentication action completed against provider `github-preview-deploy/providers/github` and service account `github-preview-deploy@rentchain-preview.iam.gserviceaccount.com`. Its successful combined step runtime-proves the approved keyless GitHub-to-Google authentication path. The logs do not provide a safe independent boundary between GitHub token issuance, Security Token Service exchange, and service-account impersonation, so those internal substeps are not claimed separately.

Project inspection and enabled-service inspection are independently runtime-proven by their successful commands and outputs.

## Trust and negative configuration evidence

The live provider condition remains a conjunction requiring:

- repository `rentchaincanada/rentchain`;
- immutable repository ID `1103977082`;
- repository owner `rentchaincanada`;
- immutable owner ID `246115482`;
- ref `refs/heads/main`;
- event `workflow_dispatch`;
- exact workflow `rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main`; and
- exact subject `repo:rentchaincanada/rentchain:ref:refs/heads/main`.

This configuration denies wrong repositories, forks, owners, workflows, refs, events, and subjects because any mismatched conjunct rejects exchange. The service-account policy contains one exact-subject `principal://` member. No wildcard principal, pool-wide `principalSet`, project-level Workload Identity User binding, feature-branch trust, pull-request trust, additional repository, additional workflow, or production trust exists.

No token was manufactured and no trust condition was changed for negative runtime testing. Negative claim behavior is configuration-proven only.

## Deployment-identity permission boundary

The deployment identity receives one project custom role containing exactly:

```text
resourcemanager.projects.get
serviceusage.services.get
serviceusage.services.list
```

It has no permission to deploy Cloud Run, push Artifact Registry images, invoke Cloud Build, modify project or service-account IAM, enable APIs, access billing, manage Firebase or Firestore, create Storage buckets, create keys or tokens, or access production. These denials are IAM-inventory proven; no mutating denial probe was attempted.

## Token, credential, and artifact hygiene

The completed workflow produced zero artifacts. A count-only scan of all 116 log lines and 14,933 bytes found zero JWT-like values, Google access-token patterns, Authorization headers, service-account JSON fields, private keys, or API-key patterns. No credential file, token, or authorization material is reproduced in this evidence.

The authentication action's runner-local credential lifecycle completed through its cleanup step. No generated credential was uploaded as an artifact.

## Post-apply HCP plan evidence

| Evidence | Value |
| --- | --- |
| Workspace | `rentchain-preview-foundation` / `ws-ebtKQ2gkLZuoRis4` |
| Configuration version | `cv-FfF4ZweCvLbPijof` |
| Run | `run-MTvKDKZkG6bwr3Bd` |
| Plan | `plan-J7ACqHwUxK2fnmsT` |
| Source | merged `main` at `1a1144aec05c2f46561cb9c5f96dd16f130fcceb` |
| Created | `2026-07-22T13:45:22.332Z` |
| Plan identity result | Keyless authentication succeeded; refresh stopped on read authorization |
| Run status | `errored` |
| Apply | None |
| Reported actions | `0 add, 0 change, 0 destroy, 0 import` before refresh stopped |

The reported zero actions are not a zero-drift result because refresh did not complete. The run stopped on these exact read-only denials:

| Permission | API | Terraform resource | Target |
| --- | --- | --- | --- |
| `iam.serviceAccounts.get` | IAM | `google_service_account.github_preview_deploy` | `github-preview-deploy@rentchain-preview.iam.gserviceaccount.com` |
| `iam.workloadIdentityPools.get` | IAM | `google_iam_workload_identity_pool.github_preview_deploy` | `projects/rentchain-preview/locations/global/workloadIdentityPools/github-preview-deploy` |
| `iam.roles.get` | IAM | `google_project_iam_custom_role.github_preview_deployment_inspector` | `projects/rentchain-preview/roles/githubPreviewDeploymentInspector` |

All three permissions are read-only. Their observation does not authorize adding them, and later refresh operations may reveal other read-only requirements. No IAM permission was added, no variable or source was changed, and the plan was not retried.

## Final state and isolation

HCP Terraform remains remote with auto-apply off and no auto-destroy configuration. State remains exactly nine resources: three B2 service resources and six B3 identity resources. The failed validation plan added no state resource and ran no apply.

User-managed key counts remain:

| Service account | Keys |
| --- | ---: |
| HCP plan | 0 |
| HCP apply | 0 |
| GitHub deployment inspector | 0 |

Cloud Run Admin and Artifact Registry APIs remain disabled. Storage buckets remain zero. No workload, image, build, public access, billing change, new managed API, Firebase/Firestore initialization, or production access occurred. Production was intentionally unqueried and remains outside the workspace, identity, state, and workflow boundaries.

PR #1435 remains at `913ff639e4b1d0841137950568534959481d34df`, draft, open, and on hold. No B4 branch, PR, resource, or implementation was created.

## Cost impact

The workflow consumed approximately 13 seconds of GitHub-hosted runner time. WIF exchange, IAM inspection, and the failed Terraform refresh have no expected material incremental Google Cloud cost. Expected incremental cost is approximately CAD 0.

## Remaining limitation and next boundary

Runtime identity validation is complete. Terraform zero drift is not proven. A separately reviewed mission must audit the provider refresh operations and design the narrowest read-only HCP plan-role permission revision. That mission must not grant create, update, delete, undelete, policy mutation, key, token, deployment, billing, workload, or production capability and must not retry planning until separately authorized.

B4 remains unauthorized and unstarted.

## Classification

**B3 runtime identity validated; zero-drift requires bounded read revision.**
