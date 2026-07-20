# Reusable Preview Infrastructure Implementation Readiness v1

## Executive summary

RentChain should build a reusable isolated preview stack now, beginning with one shared non-production staging foundation and exact-head backend deployment support. It should not begin with a full ephemeral project per pull request.

This recommendation is option A with a phased architecture: establish one isolated Firebase/GCP environment, use temporary or tagged Cloud Run revisions/services for exact-head validation, route selected Vercel previews explicitly, and add deterministic role fixtures and teardown. Expand to full per-PR environments only after shared staging demonstrates a real concurrency or isolation limitation.

This document is an implementation-readiness decision, not infrastructure authorization. It creates no cloud resources, credentials, users, data, routes, workflows, or runtime behavior. PR #1435 remains blocked and draft. Operational Credits Phase 1A remains paused.

## Decision context

PR #1436 established that the current repository cannot safely execute authenticated exact-head preview QA:

- committed Cloud Build defaults target production;
- committed Vercel rewrites target production Cloud Run;
- accessible configuration identifies only the existing production cloud project;
- authenticated Playwright role fixtures are mocked/test-only rather than real deployed sessions;
- no isolated Auth, Firestore, Storage, preview-role session, provider-suppression, or teardown capability is available.

The immediate trigger is PR #1435, but the gap affects every future backend-plus-frontend change that requires real authorization, Firestore behavior, multi-role isolation, or user-visible workflow QA.

## Options evaluated

### Option A — Build a reusable isolated preview stack now

Create a shared non-production GCP/Firebase foundation, add exact-head backend deployment and explicit frontend preview routing, then add deterministic authentication, fixtures, provider suppression, and cleanup.

### Option B — Build a smaller authenticated test harness

Use a local or controlled test service with emulator-backed data and real route middleware, without deploying a complete preview stack.

### Option C — Defer preview infrastructure

Keep PR #1435 and similar user-visible integration work blocked until a later platform investment.

### Option D — Re-scope PR #1435

Split backend aggregation, frontend projection, deep-link behavior, and messaging mutations into independently testable pull requests while retaining the final authenticated integration gate.

## Comparative decision matrix

Ratings are relative: low is favorable for effort, cost, risk, and burden; high is favorable for verification value.

| Criterion | A. Reusable stack | B. Test harness | C. Defer | D. Split PR #1435 |
| --- | --- | --- | --- | --- |
| Initial engineering effort | High | Medium | Low | Medium |
| Ongoing cloud cost | Medium | Low | Low | Low |
| Security implementation risk | Medium to high | Medium | Low now, increasing release risk | Medium |
| Maintenance burden | Medium | Medium | Low | Medium |
| Effect on RC1 delivery | Short-term delay, long-term unblock | Partial unblock only | Indefinite block | Smaller reviews but final block remains |
| Future PR reuse | High | Medium | None | Low |
| Exact-head frontend/backend proof | Yes | No, unless separately deployed | No | No final proof |
| Real Firebase Auth proof | Yes | Partial or emulator-only | No | No final proof |
| Real Firestore query/index proof | Yes in non-production | Partial or emulator-only | No | No final proof |
| Automated browser E2E | Strong | Moderate | None | Moderate unit/smoke only |
| Multi-role isolation QA | Strong | Moderate | None | Partial |
| Provider suppression burden | Required centrally | Required in harness configuration | Deferred | Still required eventually |
| Deterministic teardown | Required | Local cleanup | None | Test cleanup only |

## Recommendation

Choose option A, implemented incrementally through a shared isolated staging foundation. Use option B as a complementary fast feedback layer, not as the release gate. Do not choose option C because it leaves an expanding class of integration changes unverifiable. Do not use option D as a substitute for end-to-end QA; splitting PR #1435 may improve reviewability but cannot prove the integrated authorization and persistence path.

The first implementation must remain a platform foundation PR and must not deploy PR #1435 itself. The shared environment should support one supervised QA run at a time initially. Only add per-PR ephemeral expansion after measured contention or data-isolation needs justify it.

## Why shared staging first

A shared isolated staging foundation minimizes the number of cloud projects, Firebase applications, IAM policies, service identities, secrets, and cleanup systems that must be correct before the first safe test. It also enables:

- real Firebase Auth issuer and session behavior;
- real Firestore queries, indexes, transactions, and authorization mappings;
- exact-head Cloud Run deployment evidence;
- selected Vercel preview routing;
- deterministic multi-role fixtures;
- browser and API-level isolation checks;
- centralized provider suppression and audit logging.

Its principal limitation is concurrency. Use leases, fixture namespaces, serialized mutable QA, and automatic expiration before considering full ephemeral projects.

## Shared staging versus per-PR environments

Decision:

- Phase B creates one shared isolated staging GCP/Firebase project.
- Each approved QA run receives a unique run identifier and fixture namespace.
- The backend uses either a PR-specific Cloud Run service or a tagged no-traffic revision promoted only for the bounded QA window.
- Mutable authenticated E2E is serialized until fixture isolation is demonstrated.
- Full per-PR Firebase projects are deferred to Phase F.

A shared service receiving multiple code revisions simultaneously is not acceptable. Exact-head verification requires an unambiguous service/revision target for each active run.

## Ephemeral backend versus full ephemeral stack

Use an ephemeral backend over shared staging data first. The backend service is cheap to create and delete, provides exact image/revision proof, and avoids repeatedly provisioning Firebase projects. Its runtime identity must be scoped to the shared staging project only.

Full ephemeral Auth/Firestore/Storage stacks should be introduced only when:

- parallel PRs require conflicting schema, index, or data states;
- shared fixture namespaces cannot prevent interference;
- security testing requires project-level isolation;
- cleanup reliability and cost ownership are proven.

## Firebase project strategy

Provision a dedicated non-production Firebase-enabled GCP project with:

- environment classification fixed to staging/preview;
- Firebase Auth configured only for synthetic test identities;
- Firestore isolated from production;
- Storage isolated or disabled until a test requires it;
- separate quotas, billing alerts, audit logs, and IAM;
- no production project peering or cross-project credential reuse.

Do not use a secondary database inside the production project as the initial solution. Project-level separation gives stronger IAM, Auth issuer, secrets, quota, audit, and deletion boundaries.

## Preview Auth strategy

Use secure synthetic accounts in the isolated Firebase Auth project. Initial roles should cover:

- landlord;
- tenant;
- unrelated landlord;
- unrelated tenant;
- manager and contractor only when a test mission requires them.

Account passwords and captured browser storage states must remain in an approved secret store or ephemeral runner storage. They must never appear in git, PR comments, screenshots, traces, console logs, or downloadable CI artifacts.

Prefer deterministic account identifiers and resettable synthetic profiles. Do not weaken login, JWT verification, role hydration, or route middleware for preview.

## Firestore seed strategy

Use versioned seed manifests and a dedicated fixture marker containing only non-sensitive run metadata. Seed operations must be idempotent and reject the production project. Initial messaging fixtures should create the minimum organization, membership, property, unit, lease/tenancy, participants, and parent conversation records.

Each run must record locally or in a restricted staging audit collection:

- seed schema version;
- run identifier;
- created record categories;
- creation timestamp;
- expiry timestamp;
- cleanup status.

Do not publish raw document IDs or message contents in PR comments. Teardown should use the manifest, not broad collection scans or recursive deletion.

## Storage strategy

Disable Storage access by default. Enable a dedicated preview bucket only for missions that genuinely exercise uploads or stored artifacts. Apply short retention, no public access, staging-only service identity access, and fixture-key deletion.

PR #1435 tenant messaging should not require file attachments for its first QA run.

## Secret management

Use Secret Manager resources created only in the non-production project. Separate build-time public frontend configuration from backend secrets. Required rules:

- no production secret versions or replication;
- no local credential files committed or copied into images;
- least-privilege runtime access to named preview secrets only;
- secrets unavailable to untrusted pull-request code by default;
- rotation and revocation included in teardown and incident response;
- logs display only presence/classification, never values.

## Provider suppression model

Outbound integrations must be denied by default. The preview environment must not possess production credentials for email, SMS, Certn, Stripe, Rotessa, PAD, payments, signing, webhooks, analytics exports, or other vendor execution.

Preferred controls, in order:

1. No credential binding.
2. Existing explicit disabled/test mode that fails closed.
3. A reviewed non-delivering sink for workflows whose startup requires a destination.
4. Network egress restrictions where operationally supportable.

Do not add hidden bypass flags. If application startup cannot run without a real provider, that provider must be removed from the preview dependency path in a separately reviewed code change.

## Outbound network policy

Block outbound network calls by default where the selected GCP topology can enforce it without destabilizing required Google service access. At minimum:

- deny vendor credentials;
- allow only required Google APIs and the selected Auth/Firestore/Storage endpoints;
- record denied egress attempts without logging payloads;
- fail the QA run if unexpected external hosts are contacted.

A detailed VPC/egress implementation decision belongs in the Phase A threat model because Cloud Run egress controls affect cost and complexity.

## IAM and service identities

Use separate identities for:

- infrastructure provisioning;
- image build and push;
- Cloud Run deployment;
- Cloud Run runtime;
- fixture seeding and teardown;
- QA observation.

No identity should have both production and preview mutation authority for the initial foundation. The runtime identity should access only the preview data required by the app. Seed/teardown authority should not be granted to the runtime service.

Service-account impersonation should be preferred over downloaded keys for supervised operator actions. Short-lived federation should be used for CI after threat-model approval.

## Who may trigger deployment

Initial deployments must be manually approved by a designated release operator after confirming:

- trusted branch and exact head;
- environment target;
- provider suppression;
- budget and expiry;
- seed and teardown owners;
- QA scope.

Untrusted fork pull requests must never receive preview credentials or deployment authority. Automated deployment can be considered only for trusted repository branches after Phase B controls are proven.

## Who may access seeded credentials

Limit access to the assigned QA operator and security/release reviewers. Credentials should be time-bounded, distributed through the approved secret channel, and revoked after the run. Developers and automated agents should receive storage-state file paths or short-lived handles only when authorized, not password values.

## Vercel preview access and routing

Use Vercel Preview-scoped configuration to set:

- the exact backend API origin;
- preview Firebase public configuration;
- environment classification;
- any existing non-sensitive feature flags.

Production-targeted committed rewrites must not override the selected API origin. The implementation should choose one canonical proxy/routing mechanism and add tests proving Preview and Production resolve differently.

Vercel protection should remain enabled. Use an approved Vercel automation bypass token or supervised SSO access. The bypass token must be secret, scoped, rotated, and excluded from URLs stored in PR comments or artifacts.

## May preview comments expose URLs?

Preview frontend URLs may be posted only when repository visibility and Vercel protection policy allow it. Backend service URLs should remain in restricted deployment evidence unless public ingress is explicitly approved. URLs must never contain bypass tokens, signed parameters, credentials, or internal resource identifiers.

## Backend ingress and service-to-service auth

Preferred initial posture:

- keep the temporary backend non-public where Vercel server-side proxying can authenticate to it;
- use Cloud Run IAM or a dedicated service-to-service identity between the Vercel proxy and Cloud Run;
- allow supervised API QA through an approved identity-aware mechanism.

If Vercel cannot supply supported service identity without excessive complexity, a public Cloud Run URL may be considered only with application authentication intact, restrictive CORS, no provider credentials, isolated data, rate limits, bounded lifetime, and explicit security approval.

Private ingress feasibility is a Phase A decision gate, not an assumption.

## Cloud Run naming and commit proof

Use deterministic, non-production names such as a staging service plus PR-specific service suffix. Names must never collide with production. Images should include the full commit SHA or an unambiguous immutable tag and retain digest evidence.

Before QA, record privately:

- project and region classification;
- service and revision;
- image digest;
- expected commit;
- creation timestamp;
- traffic allocation;
- expiration timestamp.

Health endpoints may expose only safe presence or shortened build metadata. Exact proof should come from authenticated cloud metadata and immutable image provenance.

## Data retention and cleanup timing

Default retention:

- browser storage states: delete immediately after QA;
- synthetic messages and operational records: delete after evidence review, no later than the configured run expiry;
- temporary Cloud Run service/revision: disable immediately after QA and delete after the short evidence window;
- non-sensitive QA summaries: retain according to repository QA policy;
- traces/screenshots: retain only when redacted and necessary.

Every run must have an expiration timestamp. A scheduled sweeper may be introduced only after manual teardown is proven and must act only on explicit preview fixture markers.

## Cost ceilings and concurrency

Phase A must set numeric budgets before provisioning. Recommended control types:

- Cloud Billing budget alerts for the preview project;
- low Cloud Run maximum instances and scale-to-zero;
- bounded build minutes and artifact retention;
- Firestore and Storage quotas/alerts;
- one mutable authenticated QA run at a time initially;
- a maximum environment lifetime;
- owner acknowledgment before extension.

This document does not set currency amounts because current cloud pricing, expected test volume, and organizational budget approval have not been supplied.

## Protected branches and trust boundaries

- Deploy only immutable commits from trusted branches in the primary repository.
- Require substantive CI before deployment.
- Require environment approval for any workflow receiving preview secrets.
- Do not expose secrets to forked pull requests.
- Pin the expected head and fail if it changes during deployment.
- Preserve branch protection and review requirements; preview readiness does not authorize merge.

## Audit logging

Retain metadata-only logs for:

- who approved and triggered deployment;
- commit, image, revision, environment, and expiry;
- seed and teardown status;
- provider-suppression verification;
- QA scenario status and denial status codes;
- cleanup verification and exceptions.

Exclude credentials, tokens, cookies, password values, raw message bodies, provider payloads, and unrestricted internal identifiers.

## Automated E2E support

After manual flows are proven, provide authenticated Playwright projects for landlord, tenant, unrelated landlord, and unrelated tenant. Tests should cover:

- real login and `/api/me` hydration;
- tenant message send;
- landlord badge and Unified Inbox projection;
- search and unread filtering;
- message deep link, refresh, read state, and reply;
- cross-landlord and cross-tenant denial;
- existing lifecycle item regression;
- teardown verification.

Storage states must be generated into ephemeral runner storage. Tests must redact or disable traces and screenshots when sensitive content could appear.

## Threat model summary

Material risks include:

| Risk | Impact | Required control |
| --- | --- | --- |
| Preview reaches production data | Privacy and integrity incident | Separate project, identity, startup assertion, production-target denylist |
| Production credentials copied to preview | Vendor execution or data exposure | Preview-only Secret Manager, no cross-project access, secret inventory review |
| Untrusted PR obtains secrets | Credential compromise | Trusted-branch restriction, environment approval, no fork secrets |
| Real email/payment/screening executes | External side effect | No credentials, disabled modes, egress observation |
| Cross-role fixture leakage | Authorization false positive or privacy issue | Deterministic separate organizations, real denial assertions |
| Stale backend tested | False QA evidence | Immutable image digest, exact SHA, revision and traffic proof |
| Stale fixture state | Flaky or misleading QA | Run namespaces, idempotent seed, serialized mutation, teardown verification |
| Preview remains running | Cost and attack surface | Expiry, scale-to-zero, alerts, automatic/manual deletion |
| QA artifacts leak secrets/messages | Privacy compromise | Redaction, artifact minimization, short retention |
| Preview URL becomes public entry point | Increased abuse surface | Vercel protection, private/authenticated backend where feasible, rate limits |

## Material cost risks

- A dedicated Firebase/GCP project adds baseline operational ownership even when usage is low.
- Cloud Build and image retention can accumulate costs across PRs.
- Cloud Run costs increase if minimum instances or excessive concurrency environments are used.
- Firestore operations and storage grow when teardown fails.
- Private networking, egress control, and service-to-service authentication can add fixed cost and engineering burden.
- Full per-PR projects multiply quotas, IAM, audit, and cleanup work.

Shared staging, scale-to-zero, serialized QA, short retention, and deferred full-per-PR expansion minimize initial cost.

## Phased roadmap

### Phase A — Architecture decision and threat model

- approve shared staging first;
- select project ownership and region;
- define threat model and production-target rejection;
- choose IAM and workload identity model;
- choose backend ingress and Vercel-to-Cloud-Run authentication;
- define provider suppression and egress policy;
- approve budgets, quotas, retention, owners, and incident handling.

Exit gate: security, platform, privacy, and release owners approve the design and numeric cost ceilings.

### Phase B — Shared isolated staging foundation

- provision non-production GCP/Firebase project;
- configure isolated Auth, Firestore, and optional Storage;
- create separate least-privilege identities;
- configure preview-only secrets and audit logs;
- implement production-target rejection and environment assertions;
- support exact-head backend build/deploy/disable/delete;
- prove provider credentials are absent and outbound execution is disabled.

Exit gate: a harmless exact-head backend can be deployed and deleted without accessing production.

### Phase C — Frontend preview routing

- define canonical Preview API routing;
- configure Vercel Preview Firebase public values;
- preserve Vercel protection;
- add environment metadata and commit proof;
- verify browser traffic never reaches production.

Exit gate: exact-head frontend and backend communicate exclusively within the preview boundary.

### Phase D — Automated seed and teardown

- add versioned synthetic fixture manifests;
- create minimum multi-role records;
- add idempotent teardown by fixture marker;
- add expiry, sweeper, artifact retention, and cost safeguards;
- verify repeated seed/teardown cycles.

Exit gate: fixture creation and complete cleanup are deterministic and auditable.

### Phase E — Authenticated E2E

- create secure synthetic Auth users;
- generate ephemeral role storage states;
- add messaging continuity and isolation scenarios;
- record non-sensitive deployment and QA evidence;
- prove teardown removes sessions and data.

Exit gate: PR #1435's complete authenticated QA matrix can run against exact heads.

### Phase F — Per-PR ephemeral expansion

- measure shared staging contention and isolation gaps;
- add bounded parallel services or projects only where justified;
- enforce automated expiration and destruction;
- template IAM, budgets, routing, seed, QA, and cleanup;
- preserve manual approval for secret-bearing environments.

Exit gate: multiple trusted PRs can run without state collision, cost drift, or weakened controls.

## Estimated implementation sequence

The roadmap is six separately reviewed phases. Phase A is documentation and governance. Phases B and C are the critical infrastructure path. Phases D and E make the environment safely repeatable and useful. Phase F is optional optimization.

Calendar estimates are intentionally deferred until platform owners confirm the GCP/Firebase organization, Vercel plan capabilities, IAM authority, budget, and available reviewers. Treating those unknowns as fixed dates would overstate readiness.

## PR #1435 re-evaluation gate

Do not merge or modify PR #1435 merely because Phase A documentation exists. Re-evaluate only after Phases B through E are implemented and verified:

1. deploy backend exact head `913ff639e4b1d0841137950568534959481d34df`;
2. point the exact-head frontend preview only to that backend;
3. prove preview Auth and Firestore identity;
4. seed secure role sessions and minimum data;
5. run send, badge, Unified Inbox, search, unread, deep-link, read, reply, tenant confirmation, isolation, and regression QA;
6. compare exact-head tests with current main;
7. tear down all temporary resources and verify production was untouched;
8. merge only with complete evidence and required review approval or separately authorized review-only override.

## Operational Credits hold

Operational Credits Phase 1A remains paused until PR #1435 passes the authenticated exact-head gate and merges, or a separate governance decision explicitly makes PR #1435 non-blocking. This decision document does not provide that authorization.

## Recommended next branch and PR

Recommended next branch:

`docs/reusable-preview-phase-a-architecture-threat-model-v1`

Recommended PR scope: docs-only Phase A architecture decision and threat model covering project strategy, region, IAM, workload identity, ingress, Vercel integration, provider suppression, egress, numeric cost ceilings, retention, incident ownership, and approval gates.

Do not begin Phase B infrastructure implementation until Phase A is separately approved and merged.

## Non-goals

- No GCP, Firebase, Vercel, IAM, Secret Manager, Firestore, Storage, networking, or Cloud Run changes.
- No deployment workflow, script, fixture, test account, storage state, or teardown implementation.
- No production or preview data access or mutation.
- No auth, route, backend, frontend, messaging, provider, payment, screening, billing, PAD, or Operational Credits behavior change.
- No PR #1435 readiness or merge claim.
- No infrastructure implementation authorization.

## Validation plan

- confirm a one-file docs-only diff;
- run `git diff --check` and cached diff checks;
- scan for competitor names and accidental executable deployment instructions;
- confirm no runtime, workflow, package, Vercel, Firebase, Firestore, Terraform, IAM, or infrastructure file changed;
- confirm PR #1435 remains open, draft, and at its exact head;
- open the decision PR as draft for architecture, security, cost, and release review.
