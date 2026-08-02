# Production release-control Founder decisions

Status: decision package only. No live release-control resources described here have been created.

Branch: `feat/production-release-identities-environments-v1`  
Pinned base: `9bf99199ac7bf1d92a5b70fa91b25c3e18b35dc4`

## Executive finding

Cloud Run IAM does not provide field-level separation between changing a service template and changing its traffic. The candidate command `gcloud run deploy ... --no-traffic` and the promotion command `gcloud run services update-traffic ...` both require `run.services.update`. Workflow validation, exact-workflow Workload Identity Federation (WIF), GitHub environment approval, immutable evidence, and audit logs can constrain the intended path, but they do not turn the shared permission into an IAM-enforced field boundary.

The live Production runtime identity resolved during the preceding read-only audit was `915921057662-compute@developer.gserviceaccount.com`. That current observation must be refreshed immediately before any implementation. The candidate identity would need `iam.serviceAccounts.actAs` on that exact service account for a deployment that sets or preserves it. Withholding `actAs` from a promoter is a useful hypothesis: it is likely to block template updates that require attaching a service identity, including switching identities. It is not proof that every template or metadata update is blocked, and it does not block traffic changes. The absence of promoter `actAs` is a hypothesis pending runtime proof, not a hard security boundary.

Recommended pilot: Option D, human-admin execution, under Reviewer Model 3 with an explicit sunset date. The workflows prepare and verify evidence, while a separately authenticated Founder-authorized administrator performs each narrowly documented action. This avoids granting unproven automation authority during the pilot.

Recommended long-term architecture: Option C, a privileged release broker, under Reviewer Model 1. GitHub identities should request typed candidate or promotion operations from a broker rather than directly receive `run.services.update`. The broker must enforce exact project, region, service, digest, revision, zero-traffic, and traffic-transition rules and produce immutable audit evidence. The broker is itself a high-value privileged component and requires independent hardening and operations ownership.

## Evidence and permission matrix

### Candidate workflow

The ordered operations in `.github/workflows/production-candidate-deploy.yml` are:

| Step | Command or mechanism | Resource | Permission or authority | Mutation |
| --- | --- | --- | --- | --- |
| 1 | GitHub checkout and source ancestry checks | GitHub repository | `contents: read` | No cloud mutation |
| 2 | GitHub OIDC authentication | WIF provider and candidate service account | `id-token: write`, WIF impersonation | Credential exchange only |
| 3 | `gcloud artifacts docker images describe` | Exact Artifact Registry image digest | `artifactregistry.dockerimages.get` and repository read/download authority | No |
| 4 | `gcloud artifacts docker tags list` | Exact Artifact Registry repository/tag | `artifactregistry.tags.list` and repository read authority | No |
| 5 | `gcloud run services describe` | `rentchain-landlord-api` | `run.services.get` | No |
| 6 | `gcloud run deploy --no-traffic` | `rentchain-landlord-api` | `run.services.update`; image read; `iam.serviceAccounts.actAs` on the runtime service account; operation reads while polling | Yes, creates a revision and updates the service template |
| 7 | `gcloud run revisions describe` loop | Exact candidate revision | `run.revisions.get` and operation reads | No |
| 8 | Further `gcloud run services describe` calls | `rentchain-landlord-api` | `run.services.get` | No |
| 9 | Internal Cloud Run startup/readiness and liveness probes | Candidate instance | Platform probe mechanism, not a public workflow HTTP invocation | No workflow-originated request |
| 10 | `actions/upload-artifact` | GitHub Actions artifact | GitHub run-scoped artifact authority | GitHub evidence write only |

The workflow contains no automatic traffic-promotion command. Its sole Cloud Run mutation is a digest-pinned `gcloud run deploy` using `--no-traffic`, followed by comparisons intended to prove traffic and governed template fields were preserved.

### Promotion workflow

The ordered operations in `.github/workflows/production-candidate-promote.yml` are:

| Step | Command or mechanism | Resource | Permission or authority | Mutation |
| --- | --- | --- | --- | --- |
| 1 | GitHub checkout and source ancestry checks | GitHub repository | `contents: read` | No cloud mutation |
| 2 | GitHub Actions run lookup | Candidate workflow run | `actions: read` | No |
| 3 | `actions/download-artifact` and evidence validation | Candidate evidence artifact | GitHub run-scoped artifact read | No |
| 4 | GitHub OIDC authentication | WIF provider and promoter service account | `id-token: write`, WIF impersonation | Credential exchange only |
| 5 | `gcloud run revisions describe` | Exact candidate revision | `run.revisions.get` | No |
| 6 | `gcloud run services describe` | `rentchain-landlord-api` | `run.services.get` | No |
| 7 | `gcloud run services update-traffic --to-revisions=<candidate>=100` | `rentchain-landlord-api` | `run.services.update` and operation reads while polling | Yes, changes traffic |

There is no build, Artifact Registry write, `gcloud run deploy`, or explicit runtime-service-account `actAs` step in the promotion workflow. The absence of an explicit step is not an IAM guarantee; the identity's effective policies are authoritative.

### Published Google role evidence

Read-only `gcloud iam roles describe` output showed:

| Role | Relevant included permissions |
| --- | --- |
| `roles/run.viewer` | `run.services.get`, `run.services.getIamPolicy`, `run.services.list`, `run.revisions.get`, `run.revisions.list`, `run.operations.get`, `run.operations.list` |
| `roles/run.developer` | Viewer reads plus `run.services.create`, `run.services.delete`, `run.services.update`, `run.revisions.delete`, `run.operations.delete`, and Cloud Run SSH permissions |
| `roles/run.admin` | Developer capabilities plus `run.services.setIamPolicy` and tag-binding administration |
| `roles/iam.serviceAccountUser` | `iam.serviceAccounts.actAs` |

There is no separate published Cloud Run permission for “template update only” or “traffic update only”; both relevant commands authorize through `run.services.update`. Accordingly, broad predefined `roles/run.developer` is not a least-privilege proposal merely because it contains the required permission. No Cloud Run Admin, Owner, Editor, or project-wide Service Account User role is proposed.

Official references: [Cloud Run IAM roles](https://docs.cloud.google.com/run/docs/reference/iam/roles), [Workload Identity Federation for deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), and [GitHub OIDC reference](https://docs.github.com/en/actions/reference/security/oidc).

## Runtime service-account `actAs` hypothesis

Proposed asymmetric hypothesis for evaluation only:

```text
Candidate identity (conceptual ID: rentchain-prod-candidate):
  run.services.update
  + iam.serviceAccounts.actAs on the exact runtime service account

Promotion identity (conceptual ID: rentchain-prod-promoter):
  run.services.update
  without iam.serviceAccounts.actAs
```

What it can plausibly enforce:

- A candidate can submit the governed template while preserving the exact runtime service account.
- A promoter should be unable to switch the service to a different service account without `actAs` on that account.
- A new revision operation that reattaches a service identity is likely to be denied without the relevant `actAs` permission.

What it cannot establish by role inspection alone:

- It does not remove `run.services.update` from the promoter.
- It does not prevent traffic updates.
- It does not prove that changes to annotations, ingress, scaling, probes, resources, environment values, or other service settings always trigger a fresh `actAs` authorization check.
- It does not constrain the service or project unless the Cloud Run IAM binding itself is resource-scoped or condition-scoped.
- It does not prevent a candidate identity with `run.services.update` and `actAs` from changing traffic or other template fields when operating outside the governed workflow.

The runtime service-account policy must be inspected immediately before implementation for Service Account User, Service Account Token Creator, workload-identity bindings, and conditions. No candidate/promoter binding exists or is proposed in this package.

## Non-mutating runtime-proof result

The installed `gcloud run deploy`, `gcloud run services update`, and `gcloud run services update-traffic` help exposes `--no-traffic` where relevant, but no `--dry-run`, validate-only, export-only, or server-side validation mode that proves effective authorization without mutation. IAM Policy Troubleshooter is installed and can explain policies for existing principals, but it cannot prove the server's field-sensitive authorization behavior for a hypothetical mutation. Hypothetical absent identities also have no bindings to troubleshoot.

Result: no safe validate-only runtime proof is available. Promotion without runtime-service-account `actAs` can be proven only through an isolated non-Production service/project or a separately authorized, controlled runtime experiment. Neither is authorized here.

## Threat matrices

Legend: “IAM” means an explicit permission/resource boundary; “workflow” and “approval” are path controls, not direct IAM field separation.

### Candidate identity assumption

Assumed authority: `run.services.update`, exact runtime-service-account `actAs`, required reads, and exact Artifact Registry reads.

| Action | Expected boundary | Residual finding |
| --- | --- | --- |
| Change traffic | Not blocked by the assumed IAM | Workflow uses `--no-traffic` and verifies traffic; direct use of the identity could still change traffic |
| Deploy another image | Not blocked if image is readable | Digest/tag/source validation is workflow-only |
| Change environment names or values | Not blocked by shared update authority | Governed-template comparison is workflow-only |
| Alter probes, resources, or scaling | Not blocked by shared update authority | Governed-template comparison is workflow-only |
| Change runtime service account | IAM blocks accounts for which candidate lacks `actAs` | Candidate can preserve/use any account on which it has `actAs` |
| Broaden public IAM | Blocked if `run.services.setIamPolicy` is absent | Do not grant Cloud Run Admin |
| Affect another Cloud Run service | Blocked only by resource-scoped/condition-scoped IAM | Project-wide `run.services.update` would not block it |

### Promotion identity assumption

Assumed authority: `run.services.update`, required reads, and no runtime-service-account `actAs`.

| Action | Expected boundary | Residual finding |
| --- | --- | --- |
| Update traffic | Not blocked; intended capability | Exact revision/evidence checks are workflow and approval controls |
| Deploy a new image while preserving current runtime SA | Likely blocked if Cloud Run rechecks `actAs`; unproven | Requires controlled runtime proof before calling this a hard boundary |
| Change settings not requiring a new identity | Potentially possible | Shared `run.services.update` remains; no field-specific IAM boundary |
| Change environment values | Potentially possible | Whether `actAs` is rechecked is not safely testable here |
| Alter scaling, probes, ingress, or annotations | Potentially possible | Workflow contains no such command, but IAM alone may permit it |
| Switch runtime service account | Blocked unless promoter has `actAs` on the target | Effective runtime-SA policies must be verified |
| Affect another service | Blocked only by resource-scoped/condition-scoped IAM | Exact workflow constants are not an IAM resource boundary |
| Broaden public IAM | Blocked if `run.services.setIamPolicy` is absent | Do not grant Cloud Run Admin |

## Architecture options

| Option | Security boundary | Residual risk | Complexity and burden | Pilot | Long term |
| --- | --- | --- | --- | --- | --- |
| A — Workflow/process controls only | Separate WIF identities, exact workflow claims, protected environments, immutable evidence, tests, logs | Both identities still hold shared update authority; bypass of the intended workflow can exceed the stage | Medium setup; low custom operations | Possible only with explicit risk acceptance | Weak for mature separation |
| B — Shared permission with asymmetric `actAs` | Option A plus candidate-only `actAs` on exact runtime SA | Promoter template restrictions remain an unproven hypothesis; candidate can still change traffic | Medium; requires isolated runtime proof and continuous policy inspection | Possible after separate proof | Better than A, not field-level separation |
| C — Privileged release broker | GitHub invokes typed broker actions; broker validates exact candidate-only or promotion-only transitions | Broker compromise is high impact; implementation bugs become authorization bugs | Highest build, hardening, availability, and on-call burden; strongest audit surface | Too much machinery for first pilot | Recommended mature architecture |
| D — Human-admin execution | Workflows produce evidence; separately authenticated human performs one reviewed command | Human error, credential concentration, delay, and manual consistency risk | Lowest automation complexity; higher repeated operational burden | Recommended controlled pilot | Transitional, not ideal at scale |

No static GCP credential secret is proposed. GitHub OIDC/WIF is the only proposed future machine-authentication mechanism. The legacy Cloud Build deployer must not be reused; its zero-authority state remains a deliberate boundary.

## Reviewer governance models

| Model | People and self-review policy | Same approver for both stages? | Pilot suitability | Long-term suitability |
| --- | --- | --- | --- | --- |
| 1 — Strict separation | At least three roles in the normal path: operator, candidate approver, promotion approver. Triggering operator cannot approve; self-review prohibited. Emergency override is separately documented. | No | Operationally demanding | Recommended independence target |
| 2 — Two-stage approval | At least two people: operator plus independent senior approver. Self-review prohibited and evidence reviewed at both stages. | Yes | Practical if staffing is limited | Moderate independence |
| 3 — Founder-controlled pilot | Usually two people: operator plus Founder; Founder may approve both stages. Self-review remains prohibited when another operator triggers. Must include a sunset date. | Yes | Recommended temporary pilot | Not mature separation of duties |

Eligible categories, without assigning people or teams: Founder/owner, technical operator, independent approver, and emergency approver. The Founder-provided read-only GitHub snapshot identified two collaborators: `rentchaincanada` with admin access and `Boulos001` with write access; no repository teams were returned. These identities are evidence about operational feasibility only and are not reviewer assignments.

## GitHub environment capability and proposed settings

The Founder-provided read-only GitHub snapshot confirmed the existing environments `Preview`, `Preview – rentchain`, `Preview – rentchain-status`, `Production`, `Production – rentchain`, and `Production – rentchain-status`. The governed environments `production-candidate` and `production-promotion` remain absent. Repository Actions variables and secret metadata were both empty, so `PRODUCTION_WORKLOAD_IDENTITY_PROVIDER`, `PRODUCTION_DEPLOY_SERVICE_ACCOUNT`, and `PRODUCTION_PROMOTION_SERVICE_ACCOUNT` remain absent. No environment, variable, or secret was created or changed. GitHub's environment API represents required reviewers, prevent-self-review, wait timers, deployment branch policies, variables, and secrets; availability and limits depend on repository visibility and plan.

Proposed settings, not executed:

- Create each environment only after a Founder selects a reviewer model.
- Set `prevent_self_review: true` where the repository plan supports it.
- Configure the chosen required reviewer users/teams; do not assign names before the decision.
- Restrict deployments to `main` using a protected-branch or custom-branch policy.
- Use no wait timer initially unless the Founder requires a cooling-off period.
- Store only non-secret identifiers as environment variables: exact WIF provider and stage-specific service-account email.
- Store no service-account key or other static GCP credential as an environment secret.

Illustrative API shapes only; these are not commands and must not be submitted before authorization:

```json
{
  "wait_timer": 0,
  "prevent_self_review": true,
  "reviewers": [{"type": "User", "id": 123}],
  "deployment_branch_policy": {"protected_branches": true, "custom_branch_policies": false}
}
```

If custom branch policies are selected instead, create a single `main` policy after the environment exists. Environment variables and secrets use their dedicated repository-environment endpoints. Exact payload IDs must come from a fresh read-only collaborator/team query.

## Explicit Founder decisions required

1. Accept workflow/process controls despite shared `run.services.update`?
2. Require a separately authorized runtime proof of promotion-without-`actAs`?
3. Choose reviewer governance Model 1, 2, or 3.
4. Require a privileged release broker now, later, or never.

## Boundaries and deferred work

- The read-only refresh authenticated the Founder snapshot as `rentchaincanada` with repository `ADMIN` permission. PR #1453 remained open and draft at `9bf23fd49e358cb84b521519eb42c84e730803b2`; PR #1435 remained open and draft at `913ff639e4b1d0841137950568534959481d34df`.
- Production remained healthy with runtime service account `915921057662-compute@developer.gserviceaccount.com`, latest-created revision `rentchain-landlord-api-01972-blq`, latest-ready revision `rentchain-landlord-api-01967-djh`, 100% traffic on the ready revision, and `/health` HTTP 200.
- The active `deploy-rentchain-api-main` trigger remained enabled, limited to `main` and `rentchain-api/**`, using `rentchain-api/cloudbuild.yaml` and the verified build-only identity `rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com`.
- The legacy deployer remained enabled but had no project, Cloud Run service, Artifact Registry repository, user-managed key, or service-account impersonation binding. The only Production WIF pool remained HCP-specific `terraform-pool` with the `terraform-cloud` provider; no GitHub release provider or candidate/promoter identity existed.
- Preview remained at `rentchain-preview-backend-00003-42c`, image digest `sha256:270adb21de2b271eb468b28b1a591a3f27544aae162f1f028ad74c7bfd30960f`, 100% traffic, `FIRESTORE_ENABLED=false`, and direct `/health` HTTP 403.
- No IAM, WIF, GitHub environment, variable, secret, Cloud Run, traffic, Artifact Registry, Cloud Build, Terraform, Preview, Vercel, Identity Platform, or Firebase mutation was performed.
- No build, deployment, traffic promotion, test service, speculative plan, or Terraform apply was run.
- No Terraform resource was added and no workflow was modified.
- `production-candidate` and `production-promotion` were not created.
- Production PR #1453 and PR #1435 remain out of scope and must not be modified.
- The Preview apply and seed remain paused and out of scope.
- Implementation must wait for all four Founder decisions and a new authorization.
