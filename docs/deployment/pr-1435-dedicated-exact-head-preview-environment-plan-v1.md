# PR #1435 Dedicated Exact-Head Preview Environment Plan v1

## Executive summary

PR #1435 cannot complete authenticated preview QA with the repository's current deployment topology. The exact-head Vercel frontend is available, but committed rewrites send API traffic to the production Cloud Run backend. No approved, isolated non-production Cloud Run, Firebase Auth, Firestore, or Storage environment is currently available for this QA mission.

The safe next step is a separate infrastructure mission that provisions a temporary, default-deny preview stack before any PR #1435 workflow testing occurs. PR #1435 must remain open, draft, synchronized, and unchanged. This document does not authorize deployment, operator access, production data use, or merge.

## Mission and decision

The requested exact commit is `913ff639e4b1d0841137950568534959481d34df`. The deployment mission permits a temporary backend only when production isolation, credentials, outbound-call suppression, controlled authentication, bounded cost, and teardown are proven before execution.

Those gates cannot be proven with the current repository and accessible cloud configuration. Creating the missing environment would require coordinated Cloud Run, Firebase, Firestore, Storage, IAM, Vercel, authentication, seeding, and teardown work. That is broader platform infrastructure and must not be buried in PR #1435.

Decision: defer the exact-head deployment and prepare a separately reviewed infrastructure implementation plan.

## Existing capability inventory

| Capability | Current evidence | Readiness conclusion |
| --- | --- | --- |
| Per-PR backend deployment | No workflow, script, or documented service convention deploys a PR-specific backend | Not available |
| Dedicated preview Cloud Run service | Both committed Cloud Build configurations default to the production service | Not available |
| Preview Firebase project | The committed Firebase alias and accessible local cloud configuration identify only the existing production project | Not available |
| Preview Firestore and Storage | No isolated preview project, database, bucket, or runtime identity is configured | Not available |
| Preview-only environment variables | No repository Actions secrets or variables identify a preview project or service | Not available |
| Frontend preview routing | `rentchain-frontend/vercel.json` rewrites `/api` and `/health` to production Cloud Run | Unsafe for this QA |
| Preview authentication | The repository documents controlled test-account setup, but no approved non-production identity project or sessions are supplied | Not operational |
| Vercel protection bypass | No approved bypass credential or automation mechanism is available in the accessible configuration | Not available |
| Authenticated Playwright | Storage-state conventions exist, but current generated smoke fixtures use unsigned/mocked test harness behavior rather than real deployed authorization | Insufficient for this mission |
| Data seeding | A feature-specific preview fixture script exists for another workflow, but it expects an already approved preview project and is not a tenant-messaging seed path | Not reusable as-is |
| Backend freshness verification | A read-only Cloud Run revision verifier exists | Reusable after deployment |
| Teardown automation | No PR-scoped backend/auth/data teardown mechanism exists | Not available |

## Existing patterns to reuse

A future implementation should reuse these established controls rather than create parallel concepts:

- the Cloud Run revision, image, timestamp, and traffic checks in `docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md`;
- absolute `VITE_API_BASE_URL` resolution and browser-network verification;
- role-specific Playwright storage-state file paths kept outside the repository;
- the Firebase test-account role model in `docs/runbooks/firebase-test-accounts-v1.md`;
- emulator and local-production-access guards;
- fail-closed landlord, tenant, conversation, and thread authorization;
- projection-safe QA artifacts that omit tokens, credentials, raw messages, provider payloads, and internal identifiers.

The current production-targeted Cloud Build files, Firebase alias, Vercel rewrites, and mocked smoke harness must not be treated as preview-environment foundations without explicit redesign and review.

## Required environment architecture

The smallest acceptable temporary stack is:

```text
exact-head Vercel preview
  -> preview-scoped API base URL
  -> temporary Cloud Run service for PR #1435
  -> dedicated non-production runtime identity
  -> dedicated non-production Firebase Auth project
  -> dedicated non-production Firestore database/project
  -> dedicated non-production Storage bucket only if required
```

The preview backend must not inherit the production Cloud Run service's runtime identity, environment, Secret Manager bindings, Firestore project, buckets, domains, or outbound-provider credentials.

## Required platform prerequisites

Before any deployment implementation PR is approved, operators must supply independently reviewable evidence for:

1. A dedicated non-production Google Cloud/Firebase project.
2. A non-production Firebase Auth tenant or project with test-user creation approved.
3. An isolated Firestore database and, if needed, Storage bucket.
4. A dedicated read/write preview runtime service account scoped only to those preview resources.
5. A dedicated Cloud Build identity or supervised build path that cannot deploy the production service.
6. A temporary Cloud Run service name and region with bounded quotas and cost ownership.
7. Preview-only secret bindings containing no production values.
8. Explicit denial or absence of Certn, Stripe, Rotessa, PAD, email, SMS, and other real outbound execution credentials.
9. A Vercel Preview environment capable of mapping API and Firebase public configuration to the preview stack.
10. An approved Vercel access method for supervised QA without weakening application authentication.
11. A versioned seed manifest and teardown manifest.
12. Owners for deployment, security review, QA, data teardown, credential revocation, and cost verification.

## Deployment design requirements

The future backend deployment must:

- build from the exact PR #1435 SHA;
- tag the image with the full or unambiguous commit SHA;
- deploy only to a non-production service such as `rentchain-api-pr-1435`;
- require explicit project, region, repository, image, and service arguments;
- reject production project IDs and production service names;
- use a dedicated runtime identity with least privilege;
- set a small maximum instance count, bounded concurrency, and an operator-approved timeout;
- prevent production custom-domain mapping;
- retain deployment metadata needed to prove revision, image digest, commit, timestamp, and traffic;
- support immediate disablement and deletion.

The existing Cloud Build files must not be reused by changing only substitutions because their defaults and preflight assumptions target production.

## Data and credential isolation gates

Deployment must fail before container startup unless environment classification is explicitly preview and the resolved project is non-production. Startup verification must confirm:

- expected preview project identity;
- expected preview Firestore target;
- expected preview Auth issuer/project;
- expected preview Storage target or Storage disabled;
- production credential paths are absent;
- production provider credentials are absent;
- outbound email and SMS are disabled or routed only to a non-delivering sink;
- payment, PAD, screening, and vendor execution are disabled;
- no production service-account impersonation is possible.

No secret value, bearer token, password, cookie, service-account email, or raw resource identifier should appear in PR comments or committed artifacts.

## Frontend routing requirements

The exact-head frontend must be redeployed or promoted with Preview-scoped values for:

- `VITE_API_BASE_URL` pointing to the temporary Cloud Run service;
- Firebase public configuration pointing to the non-production Auth project;
- any feature flags required for tenant messaging, using existing semantics only.

The committed production rewrite currently wins for relative `/api` requests. The infrastructure implementation must define one reviewed routing approach and test it:

- a Preview-specific Vercel proxy destination driven by a Preview environment variable; or
- direct absolute API calls to the preview backend with no fallback to the production rewrite.

Browser network evidence must show that all messaging, Unified Inbox, authentication, and health requests reach the temporary backend. A production Cloud Run request during the QA session is a stop condition.

## Authentication and fixture requirements

Use real preview authorization paths. The minimum roles are:

- one landlord in organization A;
- one tenant linked to organization A;
- one unrelated landlord in organization B;
- one unrelated tenant only if required for the cross-tenant test.

Credentials must be created and shared through an approved secure channel. Playwright storage states must be captured outside the repository, limited to the preview origins, excluded from QA artifacts, and destroyed during teardown.

The existing unsigned smoke JWT and intercepted API harness may supplement UI regression tests, but it cannot satisfy deployed authentication or isolation QA.

## Minimum seed manifest

Seed only synthetic, reversible records:

- organization A and landlord membership;
- property and unit owned by organization A;
- active tenant/lease linkage;
- one parent conversation with the tenant participant;
- organization B and unrelated landlord membership;
- unrelated tenant linkage only when needed.

Every seeded record must carry a preview-only fixture marker and PR reference in fields already safe for that collection. The manifest must enumerate record types and deletion order without placing raw IDs or message contents in the PR.

## Outbound execution controls

The preview environment must not contain credentials or enabled paths for:

- Certn or other screening providers;
- Stripe, Rotessa, PAD, payment, deposit, rent collection, or money movement;
- Mailgun, SMS, or other real-user delivery;
- production signing or document delivery;
- production analytics or webhook destinations.

If application startup requires any provider configuration, use an approved non-delivering stub or fail-closed disabled mode already supported by the code. Adding a new provider bypass is outside this plan.

## Required QA evidence

After the platform prerequisites and deployment are separately approved, capture non-sensitive evidence for:

1. Frontend deployment ID and exact SHA.
2. Backend service, revision, image digest, creation time, exact SHA, and traffic.
3. Preview cloud/Firebase project classification without publishing credential details.
4. Browser network host proving preview-to-preview routing.
5. Tenant send persistence in the intended parent conversation.
6. Landlord badge, Unified Inbox projection, unread filter, search, bounded preview, and normal priority.
7. `/messages?threadId=...` selection, refresh safety, read state, reply persistence, and return-state consistency.
8. Tenant receipt of the landlord reply.
9. Unrelated landlord list, detail, reply, read, and guessed-thread denial status codes.
10. Unrelated tenant denial.
11. Existing lifecycle item regression, one-item-per-conversation behavior, invalid/missing deep-link behavior, and absence of duplicate read state.
12. Exact-head CI and current-main backend baseline comparison.

Artifacts must redact tokens, cookies, passwords, full message bodies, internal IDs, and sensitive payloads.

## Teardown plan

The implementation plan must make teardown executable and independently verifiable:

1. Disable traffic to the temporary backend.
2. Remove Preview-scoped Vercel variables or deployment mappings created for PR #1435.
3. Delete or disable seeded Auth users.
4. Delete preview-only fixture records using the reviewed manifest.
5. Delete preview-only stored objects.
6. Revoke temporary credentials and bindings.
7. Delete the temporary Cloud Run service and images according to retention policy.
8. Confirm production Cloud Run, Firestore, Auth, Storage, domains, and provider systems were unchanged.
9. Record only non-sensitive teardown evidence.

Reusable preview infrastructure that predates this mission must not be deleted. No such reusable environment was found during this audit.

## Split implementation recommendation

Do not implement this platform work in PR #1435. Use separately approved, reviewable changes:

1. Preview project, IAM, cost, and outbound-denial provisioning plan or infrastructure PR.
2. PR-scoped Cloud Run build/deploy and teardown tooling with production-target rejection tests.
3. Vercel Preview routing and Firebase public-config separation.
4. Synthetic messaging fixture and secure preview-auth setup.
5. Authenticated Playwright coverage for messaging continuity and isolation.
6. PR #1435 exact-head deployment, QA, teardown, and merge decision.

Each implementation step must preserve existing production behavior and require separate authorization before mutation.

## Stop conditions

Stop immediately if any of these are unresolved:

- the project, database, Auth issuer, bucket, runtime identity, or secret scope is ambiguous;
- any production credential or provider credential is inherited;
- production Cloud Run receives preview QA requests;
- a required provider cannot be disabled safely;
- Vercel protection cannot be accessed through an approved mechanism;
- test credentials cannot be transferred securely;
- fixture deletion cannot be proven;
- implementation requires changes to PR #1435 unrelated to a demonstrated messaging defect.

## PR #1435 disposition

PR #1435 remains:

- open;
- draft;
- at exact head `913ff639e4b1d0841137950568534959481d34df` unless a real defect is found later;
- blocked from merge;
- blocked from authenticated preview QA until the isolated environment exists.

Operational Credits Phase 1A remains paused. No PR #1435 merge, admin override, production deployment, production data mutation, or authentication weakening is authorized by this plan.

## Non-goals

- No infrastructure is created or changed.
- No Cloud Run service is deployed.
- No Firebase project, Auth user, Firestore record, or Storage object is created.
- No Vercel environment variable or protection setting is changed.
- No credential is created, read, logged, or committed.
- No production or preview data is mutated.
- No application, route, auth, provider, payment, screening, messaging, or UI behavior changes.
- No PR #1435 readiness or merge claim.

## Validation plan

For this planning document:

- confirm the diff is docs-only and one file;
- run `git diff --check`;
- scan for competitor names and execution commands that could be mistaken for authorization;
- scan for credential, token, secret, provider, Firestore, environment, infrastructure, and protected-scope drift;
- confirm PR #1435 remains unchanged and draft;
- confirm the planning branch is clean after publishing.
