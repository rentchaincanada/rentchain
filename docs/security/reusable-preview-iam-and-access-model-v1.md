# Reusable Preview IAM and Access Model v1

## Decision

Use a dedicated non-production project and separate least-privilege identities for provisioning, build/deploy, runtime, seed, teardown, E2E, observability, and human operations. Preview identities must have no permissions in production projects. Static service-account keys are prohibited.

## Identity inventory

| Identity | Purpose | Allowed capability | Prohibited capability |
| --- | --- | --- | --- |
| Infrastructure provisioner | Create approved preview resources | Narrow project service enablement, IAM binding, budgets, registry, Cloud Run, Firebase resources through reviewed process | Production project access; owner/editor; application data access |
| Build identity | Build and push images | Read trusted source, write preview Artifact Registry, attest provenance | Deploy services; read secrets; production registry access |
| Deployment identity | Create/update/delete preview Cloud Run services | Cloud Run admin on preview services, runtime identity attachment, image read | Act as production identity; modify production services; data access |
| Runtime backend | Serve application | Read/write required preview Firestore collections; selected preview secrets; optional preview bucket | IAM changes; teardown; production access; provider secrets |
| Seed identity | Create deterministic fixtures/users | Preview Auth user administration and fixture-scoped Firestore writes | Runtime deployment; production access; broad deletion |
| Teardown identity | Delete manifest-owned fixtures and revoke sessions | Fixture-marker deletes, preview Auth disable/delete, temporary secret/service cleanup as approved | Production access; unscoped collection deletion; infrastructure provisioning |
| E2E runner | Execute browser/API QA | Reach protected preview, use short-lived test sessions, read safe metadata | Cloud mutation; secret listing; production access |
| Observability reader | Review logs, metrics, cost, provenance | Read preview logs/metrics/build and billing metadata | Data writes; secret payload access; production logs unless separately assigned |
| Human operator | Approve and supervise runs | Time-bounded group access, identity impersonation for approved tasks | Download keys; permanent broad roles; production mutation through preview workflow |

## Role policy

Prefer predefined narrow roles and resource-level bindings. Where predefined roles are broader than required, define reviewed preview-only custom roles.

Prohibited roles for routine preview identities:

- project Owner;
- project Editor;
- organization Administrator;
- broad service-account Token Creator across projects;
- unrestricted Secret Manager administration;
- unrestricted Firebase/Firestore administration for runtime;
- billing-account administration;
- production project roles of any kind.

The infrastructure provisioner may require temporary elevated preview-project permissions during bootstrap. Those permissions must be time-bounded, approved, logged, and removed after provisioning.

## Workload Identity Federation

Use GitHub Actions OpenID Connect with Workload Identity Federation for trusted-branch automation after Phase A approval. Bind only the expected repository, environment, workflow, and protected branch/ref conditions. Forks and arbitrary branches must not satisfy the provider condition.

Do not create downloadable service-account keys. Local operators should use their individual identity and supervised service-account impersonation with MFA and audit logs.

## Trust boundaries

- GitHub identity may impersonate only the preview deployment identity.
- Deployment identity may attach only the preview runtime identity.
- Runtime identity may access only preview project resources.
- Seed and teardown identities are separate from runtime and from each other.
- Vercel obtains only the minimum secret or identity material required to call Preview, never GCP administration authority.
- E2E runners receive application sessions, not cloud credentials, unless a separately approved machine identity is required for metadata verification.

## Secret access

- Bind each identity to named preview secrets, not project-wide secret accessor where avoidable.
- Build identity has no runtime-secret access.
- Runtime identity cannot list all secrets.
- Seeded-user credentials are not runtime secrets and must live in ephemeral runner storage or a dedicated short-lived secret.
- Secret administrators cannot deploy application code without separate approval.
- All secret accesses are audited.

## Production deny boundary

Before Phase B, verify:

- no preview service account appears in production IAM policies;
- preview Workload Identity pools/providers cannot impersonate production identities;
- production organization policies deny key creation and unapproved cross-project grants where available;
- deployment/seed/teardown tooling rejects known production project and service identifiers;
- preview runtime has no network or credential path that confers production authority.

The deny boundary must be tested, not inferred from naming.

## Human access model

- Named groups for preview platform operators, security reviewers, and QA operators.
- MFA required.
- Just-in-time or time-bounded access preferred.
- No shared human accounts.
- Separate production and preview responsibilities where staffing permits.
- Quarterly access review and immediate removal on role change.
- Emergency access requires incident ticket, reason, expiry, and post-use review.

## Audit requirements

Record:

- principal, action, resource class, timestamp, outcome, and approved run ID;
- service-account impersonation and token issuance;
- IAM and secret-binding changes;
- deployments and deletions;
- Auth user lifecycle and session revocation;
- seed and teardown counts without raw payloads.

Alert on preview identities accessing or attempting to access production, key creation, broad IAM grants, disabled audit logs, and unexpected human console mutation.

## Approval gates

- Security approves identity separation and WIF conditions.
- IAM owner approves role inventory and prohibited-role checks.
- Production owner verifies zero preview bindings in production.
- QA owner approves session-only access for E2E.
- Teardown owner approves deletion scope.
- Cost owner approves billing visibility without billing-admin overgrant.

## Non-goals

No IAM binding, service account, WIF provider, secret, project, or cloud resource is created by this document.
