# Reusable Preview Phase B Readiness v1

## Purpose

This checklist defines the minimum approvals and implementation boundary for the first shared isolated preview foundation. It does not authorize Phase B or create infrastructure.

## Phase A package inventory

- `docs/architecture/reusable-preview-architecture-decision-v1.md`
- `docs/security/reusable-preview-threat-model-v1.md`
- `docs/security/reusable-preview-iam-and-access-model-v1.md`
- `docs/security/reusable-preview-provider-suppression-v1.md`
- `docs/deployment/reusable-preview-cost-and-cleanup-controls-v1.md`
- this readiness and scope document

Together these cover architecture, topology, ingress, secrets, Auth, Firestore/Storage isolation, exact-head proof, routing, fixtures, teardown, cost, observability, CI/CD, concurrency, failure recovery, scope, and open decisions.

## Required-deliverable coverage

| Phase A deliverable | Authoritative location |
| --- | --- |
| Architecture Decision Record | Architecture decision |
| Threat Model | Threat model |
| IAM and Service Account Model | IAM and access model |
| Environment and Project Topology | Architecture decision |
| Ingress and Network Access Model | Architecture decision and threat model |
| Secret Management Model | IAM and access model |
| Provider Suppression Model | Provider suppression matrix |
| Preview Authentication Model | Architecture decision |
| Firestore/Auth/Storage Isolation Model | Architecture decision and IAM model |
| Exact-Head Deployment Proof Model | Architecture decision and this checklist |
| Frontend-to-Backend Routing Model | Architecture decision |
| Seed Data and Role Fixture Model | Architecture decision and cost/cleanup controls |
| Teardown and Expiry Model | Cost/cleanup controls |
| Cost Model and Numeric Guardrails | Cost/cleanup controls |
| Observability and Audit Model | IAM model, threat model, and this checklist |
| CI/CD and Trigger Model | Architecture decision and this checklist |
| Shared-Staging Concurrency Model | Architecture decision and cost/cleanup controls |
| Failure and Recovery Model | Threat model, cost/cleanup controls, and this checklist |
| Implementation Readiness Checklist | This document |
| Phase B Implementation Scope | This document |
| Explicit Out-of-Scope List | This document |
| Open Decisions and Blockers | This document |

## Required approvals before Phase B

| Gate | Required evidence | Approval role | Status |
| --- | --- | --- | --- |
| Architecture | Shared-project/versioned-service ADR accepted | Architecture owner | Open |
| Threat model | Threat register reviewed; medium residual risks resolved or accepted | Security owner | Open |
| IAM | Identity/role matrix, WIF trust conditions, production deny proof design | IAM owner | Open |
| Cloud project | Project owner, organization/folder, region, billing, environment classification | Platform owner | Open |
| Cost | Numeric limits, alert currency, budget owner, pause procedure | Cost owner | Open |
| Provider suppression | Complete provider inventory, deny controls, incident owner | Provider/security owner | Open |
| Data isolation | Auth/Firestore/Storage project separation and production deny tests | Data/security owner | Open |
| Ingress | Vercel-to-Cloud-Run identity or approved bounded public fallback | Security/platform owner | Open |
| Secrets | Preview-only naming, access, rotation, WIF, seeded credential channel | Security owner | Open |
| Teardown | Manifest deletion, TTL, partial failure, orphan detection | Data/platform owner | Open |
| Operations | Deployment, QA, cleanup, incident, and cost owners assigned | Release owner | Open |

Phase B is blocked while any gate is open.

## Phase B implementation scope

The smallest first implementation may include only:

- one dedicated non-production GCP/Firebase project;
- isolated Firebase Auth and Firestore;
- isolated Storage configured but disabled for application access unless required;
- preview Artifact Registry;
- separate least-privilege provision, build, deploy, runtime, seed, teardown, E2E, and observability identities;
- Workload Identity Federation for trusted GitHub automation if approved;
- preview-only Secret Manager resources;
- provider suppression defaults and verification;
- one shared staging baseline Cloud Run service plus exact-head versioned service capability;
- safe backend commit/environment metadata;
- basic Vercel Preview API and Firebase routing with no production fallback;
- one landlord, one tenant, and their minimum synthetic organization/property/unit/lease/conversation fixture;
- manual seed and teardown with manifest and run lease;
- proposed numeric quotas, budgets, expiry, logs, and alerts;
- minimal tests and runbooks proving deployment, isolation, suppression, and cleanup.

Phase B must use a harmless validation commit before PR #1435 is deployed.

## Explicitly deferred

- full multi-role authenticated E2E;
- unrelated landlord and unrelated tenant automation beyond minimum authorization probes approved for foundation validation;
- property manager, contractor, and admin fixtures;
- full per-PR GCP/Firebase projects;
- broad infrastructure-as-code refactors;
- production deployment, routing, IAM, secret, or data changes;
- Certn, Stripe, Rotessa, PAD, email, SMS, signing, AI, or other provider sandbox integration;
- payment, rent, deposit, billing, or money-movement simulation;
- automated marketplace/provider testing;
- PR #1435 source changes or merge;
- Operational Credits Phase 1A;
- autonomous deploys from arbitrary PRs or forks.

## Observability requirements

Phase B must emit metadata-only evidence for:

- deployment approver and trigger;
- trusted repository/ref and pinned commit;
- build provenance and image digest;
- Cloud Run service/revision/traffic/expiry;
- environment classification and safe routing status;
- provider-suppression status;
- seed schema, namespace, counts, lease, and expiry;
- Auth user/session lifecycle status;
- authorization failures and cross-scope probes without raw identifiers;
- cleanup counts and partial failures;
- budget and orphan alerts.

Application logs are proposed at seven-day retention; deployment/audit metadata at thirty days. Log access is limited to named platform, security, and QA reviewers. Raw message bodies, email addresses, credentials, tokens, cookies, provider payloads, bank/payment data, and unrestricted document IDs are prohibited.

## Exact-head implementation checks

- backend build receives a pinned full SHA;
- image is immutable and digest-recorded;
- safe build-info returns exact SHA and Preview classification;
- cloud metadata proves service/revision/image/traffic;
- frontend deployment ID and SHA are recorded;
- frontend safe metadata reports selected preview backend classification;
- API routing test rejects production fallback;
- frontend and backend SHA match the authorized run;
- stale or changed heads cancel readiness.

## CI/CD and trigger requirements

- trusted primary-repository branches only;
- substantive CI green before deploy;
- GitHub environment approval by release operator;
- no secrets for forks;
- one concurrency group per PR and one global mutable-QA lease;
- explicit cancellation and cleanup behavior;
- PR-close/merge/expiry cleanup request;
- separate statuses for deploy, seed, QA, and teardown;
- no admin override of security, isolation, provider suppression, cost, exact-head, QA, or cleanup failure.

## Implementation tests

Phase B must test:

- production project/service/secret denylist rejection;
- runtime startup fails on environment mismatch;
- preview identity cannot access production resources;
- provider registry fails on enabled/unknown provider;
- no outbound provider calls occur;
- Vercel Preview has no production API fallback;
- exact SHA mismatch blocks QA;
- seed idempotency, lease collision, namespace collision, and fixture cap;
- teardown ownership, delete caps, retry, and partial-failure quarantine;
- expiry and orphan detection report correctly;
- logs and artifacts redact protected content;
- cost and concurrency limits are applied.

## Manual verification before application QA

1. Deploy a harmless exact-head service.
2. Verify project, identity, revision, image digest, SHA, traffic, limits, and expiry.
3. Verify Vercel Preview routes only to Preview.
4. Verify normal Preview Auth and Firestore operations with synthetic records.
5. Attempt approved negative production-access probes and confirm denial.
6. Verify every provider is suppressed and no egress occurs.
7. Seed and tear down the minimum fixture twice.
8. Verify user/session, Firestore, Storage, secret, service, image, and lease cleanup.
9. Review logs for sensitive-data exclusion.
10. Review costs and alerts.

## Failure and recovery gates

- Production access or real provider execution: security incident; Phase B blocked.
- Commit/routing mismatch: evidence invalid; redeploy after correction.
- Cross-role access: application QA blocked; security review required.
- Partial teardown: quarantine environment; no new mutable run.
- Budget threshold: pause new deployments.
- Unknown resource or identity: quarantine; do not delete blindly.
- Secret or artifact exposure: revoke, rotate, restrict, and investigate.

## Open decisions and blockers

The following require operator decisions before Phase B:

1. Preview GCP organization/folder, project ID, region, and billing owner.
2. Firebase Auth project configuration and approved domains.
3. Vercel plan support for protected automated QA and server-side Cloud Run identity.
4. Private/authenticated ingress versus bounded public fallback.
5. Workload Identity Federation trust conditions and GitHub environment reviewers.
6. Final numeric budget in billing currency and automatic-pause mechanism.
7. Provider inventory completeness and whether any startup dependency needs a safe sink.
8. Seeded credential delivery system and session duration.
9. Log sink, retention, DLP/secret scanning, and authorized readers.
10. Infrastructure-as-code location and state ownership for Phase B.
11. Cleanup scheduler identity and report-only proving period.
12. Named owners for deployment, security, QA, cost, data, teardown, and incidents.

## Readiness recommendation

Further design approval is required before Phase B. The package is ready for architecture, security, IAM, cost, and operations review, but Phase B implementation is not approved while the gates and open decisions above remain unresolved.

## PR #1435 and Operational Credits

PR #1435 remains open, draft, unchanged, and blocked. It may be deployed only after the Phase B foundation and later authenticated-E2E phases are implemented and verified. Operational Credits Phase 1A remains paused unless PR #1435 later merges or a separate governance decision changes the dependency.
