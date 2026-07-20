# Reusable Preview Architecture Decision v1

## Status and decision

Status: proposed for Phase A review. No infrastructure implementation is authorized.

RentChain should begin with one shared, isolated, non-production GCP/Firebase project. Trusted pull requests may receive an exact-head, versioned Cloud Run backend service for a bounded QA window. The matching Vercel PR preview must route explicitly to that service and to preview-only Firebase public configuration. Shared staging data is namespaced by QA run and mutable authenticated runs are serialized initially.

Full per-PR GCP/Firebase projects are deferred until the shared foundation demonstrates a material concurrency, schema, or project-isolation limitation.

## Context

Current Vercel rewrites and Cloud Build defaults target production. No isolated preview Auth, Firestore, Storage, runtime identity, provider suppression, or deterministic teardown path exists. Unit tests and mocked browser fixtures cannot prove exact-head frontend/backend integration, real Firebase Auth, real Firestore behavior, or cross-role isolation.

The architecture must support PR #1435 and future authenticated workflows without weakening production controls.

## Options

| Option | Exact-head integration | Real Auth/Firestore | Cost and burden | Decision |
| --- | --- | --- | --- | --- |
| Shared isolated project plus versioned backend services | Yes | Yes | Moderate | Selected |
| Full project per PR | Yes | Yes | Highest | Deferred |
| Per-PR Cloud Run against production data | Yes | Production crossover | Unsafe | Rejected |
| Shared staging without exact-head backend | No | Yes | Moderate | Rejected |
| Local authenticated emulator E2E | No deployed proof | Emulator only | Low | Complementary only |
| Mock-only harness | No | No | Low | Complementary only |

## Resource topology

```text
Trusted GitHub pull request
  -> approved preview deployment trigger
  -> preview build/deploy identity
  -> preview Artifact Registry
  -> versioned Cloud Run service/revision

Vercel PR preview
  -> Vercel protection or approved automation bypass
  -> preview-scoped API origin
  -> preview Cloud Run backend
  -> preview runtime identity
  -> isolated Firebase Auth, Firestore, and optional Storage

QA operator or E2E runner
  -> short-lived preview credentials/session
  -> deterministic run namespace
  -> metadata-only QA evidence
  -> teardown and expiry verification
```

Project-level separation from production is mandatory. A secondary database in the production project is not an acceptable initial boundary.

## Cloud Run model

- Use a shared staging project and preview Artifact Registry.
- Deploy exact heads to deterministic non-production services such as `rentchain-api-pr-<number>`.
- Tag images immutably with the full commit SHA and retain the image digest.
- Set zero minimum instances and bounded maximum instances.
- Assign a preview-only runtime identity.
- Do not map production domains.
- Delete the service after the QA evidence window.
- Preserve a shared staging service only for platform smoke; do not silently route PR QA to it when an exact head is required.

Using separate PR services is preferred over traffic tags on one mutable service because it makes revision identity, routing, concurrency, and teardown easier to prove.

## Vercel routing model

- Vercel Preview receives the exact preview API origin and preview Firebase public configuration through Preview-scoped settings.
- A single canonical API proxy/base resolver must fail closed when Preview configuration is absent.
- Preview must never fall back to the committed production rewrite.
- Browser network evidence and a machine-readable routing assertion must prove the selected API origin.
- CSP and CORS must allow only the approved preview origins.
- Production deployments must reject preview API origins.

## Ingress decision

Preferred: authenticated Cloud Run ingress reached through a Vercel server-side proxy using a dedicated service identity or supported short-lived identity exchange.

Conditional fallback: a public Cloud Run URL may be approved for the first shared-staging phase only when application authentication remains mandatory, data and credentials are isolated, CORS is restrictive, rate limits and lifetime are bounded, provider execution is denied, and security review records why service-to-service authentication is not yet feasible.

Private ingress is desirable but must not make browser QA impossible. Phase B must prove the selected path with a minimal harmless service before application deployment.

## Authentication model

- Use a dedicated Firebase Auth project with synthetic users only.
- Do not copy production users, credentials, custom claims, or sessions.
- Exercise normal application login, JWT verification, hydration, and route authorization.
- Generate storage states into ephemeral operator or runner storage.
- Revoke sessions and disable/delete users after the run.
- Initial supported roles: landlord, tenant, unrelated landlord, and unrelated tenant.
- Add manager, contractor, and admin only when an approved QA mission requires them.

## Data isolation model

- Use isolated Firestore in the preview project.
- Use preview-only Storage or keep Storage disabled until required.
- Namespace fixtures by immutable run ID and PR number.
- Seed only synthetic data with no real personal information.
- Reject production project identifiers at seed, runtime startup, and teardown.
- Do not grant the runtime identity teardown authority.
- Teardown acts only on an explicit manifest and fixture marker.

## Shared-staging concurrency

Initial limit: one mutable authenticated E2E run at a time.

A lease record coordinates the active run and includes run ID, PR, exact head, owner, creation time, expiry, and state. Lease acquisition is transactional. Stale leases may be recovered only after expiry and operator review. Read-only smoke can run concurrently only if it cannot mutate shared fixtures.

Every record must carry the run namespace. Cleanup must reject records owned by another run. Parallel mutable runs remain blocked until Phase F proves namespace and cleanup isolation.

## Exact-head proof

Backend proof requires:

- full commit SHA injected at build time;
- immutable image digest;
- Cloud Run service and revision metadata;
- creation timestamp and traffic target;
- safe build-info response containing commit and environment classification but no secrets;
- authenticated cloud metadata verification.

Frontend proof requires:

- Vercel deployment ID and commit SHA;
- safe preview metadata containing frontend SHA and selected backend origin classification;
- browser-network or machine-readable evidence that requests reached the approved PR backend;
- an assertion that frontend and backend heads match the authorized QA head.

Branch names and green Vercel status alone are insufficient.

## CI/CD trigger model

- Trusted branches in the primary repository only.
- No secrets or deployment for forks.
- Manual environment approval by a release operator initially.
- Trigger by approved GitHub environment action or label after substantive CI passes.
- Pin the head SHA and abort if it changes.
- Use a concurrency group per PR; a new run cancels the prior non-QA deployment attempt.
- Do not cancel active mutable QA without explicit operator handoff.
- Cleanup triggers on PR close, merge, expiry, or manual abort.
- Preview success is a separate status and never replaces code review or substantive CI.
- Admin override may never bypass security, deployment, QA, or cleanup failure.

## Environment metadata and public comments

PR comments may include the protected Vercel preview URL, shortened commit, QA status, and expiry when repository policy permits. They must not include Cloud Run bypass credentials, signed URLs, tokens, passwords, cookies, service-account emails, raw document IDs, or backend URLs containing sensitive parameters.

Exact service, revision, project classification, and image digest belong in restricted deployment evidence accessible to authorized reviewers.

## Failure behavior

- Missing Preview API configuration: frontend displays a preview-unavailable state; no production fallback.
- Backend environment mismatch: startup fails before reads or writes.
- Commit mismatch: QA is blocked and deployment marked stale.
- Provider suppression failure: deployment is disabled; no QA proceeds.
- Seed conflict or active lease: new mutable run fails closed.
- Partial teardown: environment remains quarantined, credentials revoked, and incident owner notified.
- Cost threshold breach: block new deploys, scale services down, and require owner review.

## Consequences

Benefits:

- reusable exact-head integration evidence;
- real non-production Auth and Firestore behavior;
- multi-role security testing;
- isolated provider-safe QA;
- better release confidence for PR #1435 and future workflows.

Costs:

- new project, IAM, billing, Vercel, seed, teardown, and operational ownership;
- serialized QA initially;
- a short-term RC1 delay;
- security review for ingress and identity federation.

## Phase B gate

Phase B may begin only after architecture, threat model, IAM, cost, provider suppression, data isolation, teardown, project ownership, and secret-management approvals are recorded. Phase B must not change production deployment behavior or PR #1435 source.

## Non-goals

- No infrastructure, workflow, runtime, route, UI, auth, provider, or data change.
- No per-PR full project implementation.
- No production deployment modification.
- No PR #1435 merge authorization.
- No Operational Credits work.
