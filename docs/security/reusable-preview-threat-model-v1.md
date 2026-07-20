# Reusable Preview Threat Model v1

## Scope and method

This STRIDE-informed threat model covers the proposed shared non-production preview project, exact-head Cloud Run services, Vercel previews, synthetic Firebase Auth users, Firestore/Storage fixtures, CI identities, QA operators, logs, and teardown. It is a design artifact only.

Risk labels are qualitative pending organizational risk calibration. Residual risk must be accepted by the named role before Phase B.

## Assets and trust boundaries

Assets:

- production isolation;
- preview credentials and sessions;
- synthetic role relationships and messages;
- deployment provenance;
- source code and pull-request trust;
- cloud budget and resource quotas;
- QA evidence and logs;
- teardown manifests.

Trust boundaries:

1. GitHub pull request to approved deployment workflow.
2. GitHub identity to GCP deployment identity.
3. Vercel preview to Cloud Run backend.
4. Browser/E2E runner to Firebase Auth and application API.
5. Cloud Run runtime to preview Firestore/Storage/Secret Manager.
6. Seed/teardown operator to fixture resources.
7. Preview project to production organization resources.

## Threat register

| ID | Asset | Actor | Attack path | Impact | Likelihood | Preventive control | Detective control | Recovery | Residual risk | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | Production credentials | Malicious or mistaken contributor | Production secret copied into Preview | Production access or vendor execution | Medium | Separate project/secrets; deny cross-project secret access | Secret inventory and access logs | Revoke, rotate, quarantine | Low | Security owner |
| T02 | Production data | Misconfigured runtime | Preview identity resolves production Firestore | Privacy and integrity incident | Medium | Project-level isolation; startup project assertion; production deny policy | Audit logs and environment probe | Disable revision, revoke identity, incident response | Low | Platform owner |
| T03 | Production Storage | Misconfigured runtime | Preview bucket variable targets production | Document exposure or mutation | Low | Storage disabled by default; bucket allowlist | Storage access logs | Disable, revoke, assess objects | Low | Platform owner |
| T04 | IAM boundary | Compromised preview identity | Broad project/organization role enables escalation | Cross-project compromise | Medium | Resource-scoped least privilege; no owner/editor; WIF | IAM change and token-use alerts | Revoke bindings and sessions | Medium | IAM reviewer |
| T05 | Secrets | Contributor or log reader | Secret printed in build, PR comment, trace, or screenshot | Credential compromise | Medium | Redaction; masked injection; artifact policy | Secret scanning and log review | Revoke/rotate and purge artifacts | Low | Security owner |
| T06 | Deployment identity | Untrusted fork | Fork workflow receives preview secrets | Unauthorized cloud mutation | Medium | Trusted branches only; environment approval; no fork secrets | Workflow provenance logs | Revoke token and resources | Low | Release owner |
| T07 | Providers | Application code | Certn, Stripe, Rotessa, PAD, email, SMS, or vendor call executes | External side effect or money movement | Medium | No credentials; disabled adapters; egress policy | Suppression logs and egress alerts | Disable service, notify provider/security | Low | Provider-suppression owner |
| T08 | Auth credentials | External actor | Guessable seeded password or public account metadata | Unauthorized QA access | Medium | Generated high-entropy credentials; secure delivery; expiry | Auth failure and unusual-login alerts | Disable user, revoke sessions, rotate | Low | QA security owner |
| T09 | Preview session | Artifact reader | Storage-state or token replay | Role impersonation in preview | Medium | Ephemeral storage; origin scope; short session; no artifact upload | Auth/session audit | Revoke refresh tokens and users | Low | QA owner |
| T10 | Role isolation | QA code or user | Landlord/tenant fixtures linked across organizations | False pass or data leakage | Medium | Separate organizations and explicit ownership assertions | Cross-role denial tests | Quarantine fixtures and reseed | Low | Application security reviewer |
| T11 | Organization data | Authorized test user | Guessed thread or record ID crosses scope | Cross-organization access | Medium | Existing server-side authorization; fail-closed routes | 403/404 audit counters and E2E assertions | Disable environment and fix before merge | Medium | Application owner |
| T12 | Exact-head evidence | Stale deployment | Frontend or backend silently uses old revision | False QA approval | High | Immutable SHA/digest; pinned routing; no production fallback | Machine assertion and cloud metadata | Mark evidence invalid and redeploy | Low | Release owner |
| T13 | Frontend routing | Misconfiguration | Vercel Preview points to production | Production data mutation | Medium | Preview API required; production-host denylist | Network assertion and production request alerts | Stop QA, contain incident | Low | Frontend/platform owner |
| T14 | Backend routing | Misconfiguration | Backend uses production project or secrets | Production crossover | Medium | Startup guard and dedicated identity | Health metadata and audit logs | Disable revision, revoke identity | Low | Backend/platform owner |
| T15 | Fixtures | Concurrent QA runs | Seed namespace collision | Flaky tests or data leakage | Medium | Transactional lease; unique run namespace; one mutable run | Lease and collision alerts | Abort newer run and reconcile manifests | Low | QA platform owner |
| T16 | Cleanup | Faulty teardown | One run deletes another run's data | Test corruption and false evidence | Medium | Manifest ownership checks; no broad scans | Deleted-record audit and post-check | Restore/reseed synthetic data | Low | Teardown owner |
| T17 | Cleanup | Crash or expired operator session | Resources, users, data, or secrets remain | Cost and attack surface | High | TTL, PR-close hook, scheduled orphan scan | Expiry and orphan alerts | Quarantine and forced cleanup | Medium | Teardown owner |
| T18 | Public endpoint | Internet actor | Discovers preview URL and probes API | Abuse or enumeration | Medium | Vercel protection; authenticated ingress where feasible; rate limits | Request anomaly alerts | Disable service and rotate access | Medium | Security owner |
| T19 | Logs | Developer/operator | Raw message, email, token, or internal ID logged | Privacy leakage | Medium | Structured metadata-only logging and key redaction | DLP/secret scans and sampling | Restrict/purge logs and incident review | Low | Observability owner |
| T20 | Budget | Malicious actor or runaway test | Requests/builds create denial of wallet | Unexpected spend | Medium | Quotas, max instances, rate limits, concurrency, expiry | Budget alerts at 50/80/100 percent | Pause deploys and disable services | Low | Cost owner |
| T21 | Build artifacts | Registry reader | Vulnerable or untrusted image promoted | Code execution in preview | Low | Trusted head; CI gate; immutable digest; vulnerability scan | Registry provenance and scan results | Delete image and service | Low | Release owner |
| T22 | Human access | Unauthorized staff | Uses cloud console or credentials outside QA window | Data/credential misuse | Low | Group-based time-bounded access; MFA; approvals | Admin activity logs | Revoke access and investigate | Low | IAM reviewer |
| T23 | Session lifetime | Former operator | Long-lived refresh token survives teardown | Unauthorized later access | Medium | Per-run accounts or refresh-token revocation; short expiry | Post-teardown auth-user/session check | Revoke and disable/delete user | Low | Auth owner |
| T24 | Cleanup automation | Compromised sweeper | Broad delete permission used outside fixture scope | Preview project data loss | Low | Marker-constrained service; no production role; dry-run manifest | Deletion audit and count limits | Disable sweeper and restore fixtures | Low | Teardown owner |
| T25 | Service metadata | Public caller | Build endpoint leaks project, service, or sensitive config | Reconnaissance | Low | Safe allowlisted fields; no raw env or identity | Endpoint contract test | Remove exposure and redeploy | Low | Backend owner |

## Abuse cases

- A contributor modifies a workflow to deploy arbitrary code with preview secrets.
- A preview account is reused after its authorized QA window.
- A test message contains real personal information and is retained in artifacts.
- A cleanup job uses a PR number without run ownership and deletes another fixture.
- A green Vercel check is mistaken for backend revision proof.
- A disabled provider silently falls back to production credentials.
- A shared-staging lock expires during a long run and a second mutation begins.

## Required controls before Phase B

- production project deny boundaries tested;
- static service-account keys prohibited;
- trusted-branch and environment approval model documented;
- secret and artifact redaction policy approved;
- provider suppression owner signs the matrix;
- ingress decision tested with a harmless service;
- cost owner approves numeric ceilings;
- teardown owner proves partial-failure recovery design;
- incident contacts and quarantine procedure assigned.

## Incident severity triggers

Treat any production credential use, production data access, real vendor execution, cross-organization access, or secret exposure as a security incident. Stop all preview activity, disable the affected service, revoke identities/sessions, preserve metadata-only evidence, and follow the environment separation incident-response runbook.

## Residual-risk decision

Phase B is not ready until owners are assigned and every medium residual risk has an explicit acceptance or additional control. This document does not accept risk on behalf of operators.
