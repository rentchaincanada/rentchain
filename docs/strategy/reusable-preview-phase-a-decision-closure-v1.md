# Reusable Preview Infrastructure Phase A Decision Closure v1

## Executive summary

Phase A establishes a credible architecture for a permanent, shared preview foundation that can create short-lived, exact-head application environments. It does not establish operational readiness to implement that foundation.

The preferred design uses a dedicated Google Cloud and Firebase project in the Montréal region, isolated Terraform state, identity federation without stored cloud keys, authenticated ingress through a protected Vercel preview, synthetic data, provider suppression, bounded cost controls, and deterministic teardown. The repository and official platform documentation support this direction, but the RentChain-specific ownership, identity, state, credential-delivery, logging, and teardown controls have not been operationally proven.

**Final recommendation: Further design work required.**

Phase B must not begin until every blocking item in the binary readiness checklist has a named accountable owner, independently reviewable evidence, and an explicit approval record. PR #1435 remains draft and blocked. Operational Credits work remains paused.

## Scope and non-authorization statement

This document is a docs-only decision-closure record. It changes no runtime behavior and authorizes no infrastructure creation, deployment, credential delivery, provider traffic, production access, or Phase B implementation.

It does not authorize edits to Terraform, Firebase, Google Cloud, Vercel, GitHub Actions, IAM, secrets, billing, routes, jobs, UI, Firestore rules, application code, or production data.

## Project ownership decision

The proposed permanent foundation is a dedicated Google Cloud and Firebase project:

| Field | Proposed decision | Approval status |
| --- | --- | --- |
| Display name | RentChain Preview Staging | Requires named owner confirmation |
| Project identifier | `rentchain-preview-staging`, subject to global availability and an approved deterministic suffix if unavailable | Requires creation-time verification |
| Lifecycle | Permanent shared foundation; application revisions and test data remain short-lived | Requires Product Owner approval |
| Business/legal owner | Product Owner | Named person not confirmed |
| Technical owner | Platform Engineering Owner | Named person not confirmed |
| Billing owner | Billing Owner | Named person not confirmed |
| Security approver | Security Owner | Named person not confirmed |
| Project creator | Cloud Platform Administrator | Named person and authority not confirmed |
| Deletion approvers | Product Owner and Billing Owner, with Security Owner review | Named people not confirmed |

Required resource labels are:

| Label | Value |
| --- | --- |
| `environment` | `preview` |
| `system` | `rentchain` |
| `managed-by` | `terraform` |
| `cost-centre` | `preview-qa` |
| `data-classification` | `synthetic` |
| `lifecycle` | `permanent-foundation` |

No production project, production Firebase application, production storage bucket, or production Terraform state may be reused.
The project must reside in an approved non-production organization folder when such a folder exists. If RentChain has no governed non-production folder, the Cloud Platform Administrator and Security Owner must document the temporary placement, inherited policies, and migration plan before project creation.

## Region and data-location decision

The proposed primary region is **`northamerica-northeast1` (Montréal)** for Cloud Run, Firestore regional storage, Artifact Registry, Cloud Storage, and regional Secret Manager replication. This aligns the principal preview data and compute services in Canada and avoids unnecessary cross-region latency and egress.

The choice is supported by the published service-location catalogs for [Cloud Run](https://cloud.google.com/run/docs/locations), [Firestore](https://cloud.google.com/firestore/docs/locations), [Artifact Registry](https://cloud.google.com/artifact-registry/docs/repositories/repo-locations), and [Secret Manager](https://cloud.google.com/secret-manager/docs/locations). Service availability must be rechecked immediately before any implementation approval.

Firebase Authentication is isolated by project, but this plan does not make a regional data-residency claim for the service. The security and privacy reviewers must approve its use based on the provider's then-current terms and documented data handling.

Toronto and multi-region deployment are deferred. They may be reconsidered only if Montréal lacks a required service or an approved resilience requirement justifies the added complexity and cost.

## Billing and cost-control decision

The Phase A cost envelope remains proposed, not approved:

| Control | Proposed value | Required approval |
| --- | --- | --- |
| Monthly preview budget | CAD 100 | Named Billing Owner |
| Budget notifications | 50%, 80%, and 100% | Billing Owner and Platform Engineering Owner |
| Abnormal daily-spend trigger | CAD 15 | Billing Owner |
| Automatic deployment pause | At 100% of monthly budget | Billing Owner and Security Owner |
| Resume authority | Billing Owner and Security Owner jointly | Named owners |
| Budget increase authority | Billing Owner and Product Owner jointly | Named owners |
| First response to abnormal spend | Within 24 hours | Named Billing Owner |
| Closure or escalation | Within 48 hours | Billing Owner and Platform Engineering Owner |
| Container image retention | 14 days | Platform Engineering Owner |
| Cloud Run revision retention | Latest 3 revisions per preview service | Platform Engineering Owner |
| Temporary seed/output storage | Maximum 100 MiB per run | Security Owner |
| Operational log retention | 7 days | Security and Privacy Owners |
| Non-sensitive run metadata | 30 days | Security and Privacy Owners |

Budget notifications do not impose a hard provider spending cap. The deployment pause, resource quotas, maximum instance settings, teardown controls, and owner response process are therefore mandatory controls, not optional enhancements.

## Ingress and Vercel feasibility decision

Vercel documents Preview and branch-specific environment variables, deployment protection, and OpenID Connect identity tokens. These capabilities make the proposed ingress design technically plausible, but their configuration in the RentChain Vercel project has not been verified. References: [Vercel environment variables](https://vercel.com/docs/environment-variables), [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication), and [Vercel OIDC](https://vercel.com/docs/oidc).

The preferred request path is:

1. An authorized reviewer accesses a protected Vercel preview.
2. Browser requests remain same-origin to a narrowly scoped Vercel server-side proxy.
3. The proxy obtains short-lived identity through Vercel OIDC and an approved Google Cloud workload-identity trust.
4. The proxy invokes an authenticated Cloud Run service.
5. No Google Cloud credential, service-account key, or backend bearer token reaches browser code.

The following proof is required before Phase B:

- the RentChain Vercel plan and project support the required protection and OIDC controls;
- the exact Vercel token issuer, audience, subject, environment, project, team, and deployment claims are documented from a non-sensitive test token;
- Google Cloud accepts only the approved claims and produces a short-lived identity usable for the intended Cloud Run audience;
- the proxy cannot select an arbitrary backend origin or audience;
- direct unauthenticated Cloud Run access is denied; and
- browser bundles and network traces contain no cloud credential or backend identity token.

### Bounded fallback

A public Cloud Run endpoint is not approved. If the preferred exchange proves infeasible, Security may review a temporary fallback only with all of these controls: exact protected-preview origin allowlisting, application authentication, strict rate limiting, maximum two instances, synthetic data only, no production credentials, provider deny controls, monitoring, a maximum 24-hour exception, and deterministic teardown. The exception must have named Security and Platform owners and an expiry time before deployment.

Ingress remains a Phase B blocker until one model is proven and approved.

## Workload identity trust model

Static Google Cloud service-account keys are prohibited. Google recommends workload identity federation for deployment pipelines because it uses short-lived credentials rather than service-account keys; GitHub Actions is a supported external identity source. References: [deployment-pipeline workload identity federation](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) and [workload identity federation overview](https://cloud.google.com/iam/docs/workload-identity-federation).

The proposed trust boundary is limited to:

- GitHub organization: `rentchaincanada`;
- repository: `rentchain`;
- approved workflow identity pinned to the protected default branch;
- approved preview environment with required reviewers;
- non-forked repository executions only;
- explicitly allowed branch or pull-request context; and
- an exact preview project, service, and audience.

The eventual attribute condition must validate the repository, repository owner, workflow reference, event class, ref or environment, and intended audience. Pull-request-target execution and fork-origin identities must be denied. The final claim names and expression must be derived from captured GitHub OIDC metadata and reviewed against current Google Cloud syntax; this document intentionally does not present an untested policy expression as deployable configuration.

Separate least-privilege identities are required for deployment, synthetic seeding, and teardown. No one identity may have broad project administration. Human break-glass access requires MFA, supervised impersonation, a time-limited grant, incident logging, and post-use revocation.

WIF remains blocked pending a named IAM owner, captured claims, tested conditions, exact role inventory, and Security approval.

## Terraform state ownership decision

The proposed state model is a dedicated Terraform Cloud workspace named `rentchain-preview-staging`, separate from all production state. Existing GitHub checks indicate a Terraform Cloud integration, but the repository does not independently prove the organization, workspace, state ownership, encryption, locking, recovery, or apply authority.

Phase B requires evidence for:

- Terraform Cloud organization and workspace ownership;
- state encryption and access control;
- exclusive locking and concurrency behavior;
- plan and apply identities;
- required reviewer controls;
- state backup or recovery procedure;
- drift review ownership;
- emergency lock and teardown authority; and
- explicit proof that preview resources cannot enter production state.

No local state, repository-committed state, shared production workspace, or implicit backend is allowed. Terraform state readiness remains blocked.

## Provider suppression inventory

Preview must be deny-by-default for external providers. Absence of a credential is necessary but not sufficient; provider construction, outbound requests, callbacks, and mutation paths must also fail closed.

| Category | Code/configuration and current behavior | Preview mode | Required proof | Accountable owner | Status |
| --- | --- | --- | --- | --- | --- |
| Stripe billing/payments | `rentchain-api/src/services/stripeService.ts`, `rentchain-api/src/lib/payments/providers/stripePaymentProvider.ts`, billing/webhook routes, and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price variables support live billing/payment behavior when configured | Disabled; no keys, prices, callbacks, intents, charges, subscriptions, or mutations; outbound network denied | Startup and request tests prove provider construction and egress are denied | Payments Owner | Owner and proof missing |
| Mailgun email | `rentchain-api/src/services/emailService.ts`, email/webhook routes, and `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `EMAIL_FROM` support outbound email and provider callbacks when configured | No-op/blocked; no credentials and no outbound or inbound delivery; outbound network denied | Tests prove send and webhook paths fail closed | Messaging Owner | Owner and proof missing |
| SendGrid legacy email | Legacy SendGrid references remain in messaging, screening webhook, and rental-application routes and may send when legacy configuration is present | Blocked; no credentials and no outbound traffic; outbound network denied | Inventory and tests cover every legacy call site | Messaging Owner | Owner and proof missing |
| OpenAI | `rentchain-api/src/config/openai.ts`, `rentchain-api/src/ai/agent.ts`, related services, and `OPENAI_API_KEY` support outbound model requests when configured | No-op/blocked; no API key and no outbound model requests; outbound network denied | Tests prove AI entry points return an explicit unavailable state | AI Owner | Owner and proof missing |
| Signing | `rentchain-api/src/services/signing/providers/`, `SIGNING_PROVIDER`, `SIGNING_PROVIDER_API_KEY`, webhook-secret, and test-mode configuration select mock or external signing behavior | Fake/mock-only, with no external provider key or webhook; outbound network denied | Tests prove only the approved local mock can load | Signing Owner | Owner and proof missing |
| Screening and TransUnion | Provider-neutral screening services/routes and TransUnion referral/webhook configuration support referral or callback behavior when configured | No-op/blocked; no referral creation, webhook acceptance, or provider request; outbound network denied | Tests prove all external screening behavior is denied | Screening Owner | Owner and proof missing |
| Certn | No active Certn adapter or configuration found in the audited paths | Explicitly denied, including future or unknown provider configuration | Inventory guard fails if a new provider appears without approval | Screening Owner | Owner and proof missing |
| Rotessa and PAD | No active Rotessa integration or configuration was found in audited paths; payment/PAD scheduling route and service surfaces exist | Explicitly blocked; no banking data, PAD schedule, or payment mutation; outbound network denied | Dependency and egress scans plus mutation-path tests | Payments Owner | Owner and proof missing |
| SMS and push | No clearly configured external provider found in audited configuration | Unconfigured and denied | Inventory guard covers new variables and clients | Messaging Owner | Owner and proof missing |
| Maps and geocoding | No clearly configured external provider found in audited configuration | Unconfigured and denied | Inventory guard covers new variables and clients | Platform Engineering Owner | Owner and proof missing |
| External analytics and error reporting | Internal analytics exist; no approved external destination identified | External export denied | Network and configuration inventory tests | Privacy Owner | Owner and proof missing |
| Storage notifications | No approved external binding identified | Disabled | Infrastructure inventory and callback checks | Platform Engineering Owner | Owner and proof missing |
| Inbound webhooks | Stripe, Mailgun, signing, screening, and TransUnion paths exist | Unavailable in preview unless separately approved for a synthetic stub | Route inventory proves no provider callback can mutate preview state | Security Owner | Owner and proof missing |

Provider suppression remains a hard blocker until the inventory is complete, owners accept it, and automated controls cover initialization, egress, callbacks, and mutation behavior.

## Credential delivery decision

The initial preview must not depend on external email delivery. Passwordless links are therefore not the default credential path.

The proposed model is:

- generate high-entropy, per-run synthetic reviewer credentials or create dedicated synthetic Firebase Auth users through the approved seed identity;
- deliver credentials only through an approved password manager or equivalent ephemeral secret-sharing mechanism;
- never place credentials in Git, pull requests, build logs, Terraform outputs, Vercel output, screenshots, tickets, or chat;
- keep runner-side credential material only in ephemeral memory or protected temporary storage;
- limit credential and application-session lifetime to no more than 24 hours;
- revoke or delete synthetic users and sessions during teardown;
- prevent automated tooling from printing credential values; and
- retain only non-sensitive creation, expiry, revocation, and outcome metadata.

Required owners are the Security Owner for mechanism approval, Platform Engineering Owner for implementation, QA Owner for reviewer handling, and Privacy Owner for retention. The mechanism remains unapproved until those people are named and an end-to-end non-sensitive evidence package proves issuance, delivery, use, expiry, and revocation.

## Logging and observability ownership

| Log or signal | Allowed content | Prohibited content | Retention | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Deployment | Commit, PR, service, revision, timestamps, non-sensitive outcome | Credentials, tokens, environment values, payloads | 7 days | Platform Engineering Owner | Unassigned |
| Authentication | Synthetic actor category, authentication outcome, timestamp, correlation ID | Passwords, tokens, raw claims, personal email addresses | 7 days | Security Owner | Unassigned |
| Firestore access | Resource category, allowed/denied outcome, synthetic run ID where available | Document contents, raw paths presented as operator output, production identifiers | 7 days | Security Owner | Unassigned |
| Seed | Synthetic fixture version, resource counts, non-sensitive outcome | Generated credentials, document bodies, raw identifiers in reviewer-facing output | 7 days | QA Data Owner | Unassigned |
| Application | Request correlation, route class, status, latency | Raw request bodies, PII, financial data, provider payloads | 7 days | Backend Owner | Unassigned |
| Security | Authentication outcome, denied policy, actor category, correlation ID | Passwords, bearer tokens, raw identity assertions | 7 days | Security Owner | Unassigned |
| Provider suppression | Provider category, blocked/allowed result, reason code | Provider credentials, customer payloads | 7 days | Security Owner | Unassigned |
| Teardown | Run identifier, resource class, delete outcome, residual count | Secrets and user data | 30 days | Platform Engineering Owner | Unassigned |
| Cost | Project, service category, threshold, response status | Payment credentials or unrelated billing data | 30 days | Billing Owner | Unassigned |

Alert routing, acknowledgment targets, redaction enforcement, access review, deletion verification, and incident escalation must be tested before Phase B approval.

## Cleanup identity and ownership

Teardown uses a dedicated least-privilege identity distinct from deployment and seeding. It may delete only preview resources listed in a signed or integrity-protected run manifest for the dedicated preview project.

The cleanup contract must cover Cloud Run services and revisions, temporary Artifact Registry images, synthetic Firebase Auth users, synthetic Firestore data, temporary Cloud Storage objects, ephemeral secrets, access grants, and any run-specific DNS or proxy mapping created by the approved design.

Proposed controls are:

- teardown starts immediately after the QA window and no later than 24 hours after environment creation;
- failure alerts reach the Platform Engineering Owner and Security Owner within 15 minutes;
- an independent residual-resource check runs after teardown;
- residual resources fail the run and block subsequent deployments;
- the maximum orphan lifetime is 24 hours;
- emergency cleanup authority is time-limited and logged; and
- permanent foundation deletion requires the separate project-deletion approval model.

Required evidence includes repeatable successful teardown, idempotent retry, partial-failure recovery, manifest tamper rejection, scope-escape rejection, orphan detection, and retained non-sensitive audit metadata. Cleanup remains blocked pending named owners and proof.

## Operational owner matrix

| Decision area | Accountable role | Required supporting roles | Named owner confirmed | Phase B effect |
| --- | --- | --- | --- | --- |
| Business purpose and lifecycle | Product Owner | QA Owner | No | Blocked |
| Engineering delivery | Engineering Owner | Platform Engineering Owner | No | Blocked |
| Cloud project ownership | Cloud Project Owner | Cloud Platform Administrator | No | Blocked |
| Security and ingress | Security Owner | Platform Engineering Owner | No | Blocked |
| Security approval | Security Approver | Security Owner | No | Blocked |
| IAM and WIF approval | IAM Approver | Security Owner | No | Blocked |
| Terraform workspace and state | Infrastructure State Owner | Platform Engineering Owner | No | Blocked |
| Billing and cost response | Billing Owner | Product Owner | No | Blocked |
| Data classification and retention | Privacy Owner | Security Owner | No | Blocked |
| Synthetic seed data | QA Data Owner | Privacy Owner | No | Blocked |
| Preview operation | Preview Operator | Platform Engineering Owner | No | Blocked |
| QA acceptance | QA Owner | Product Owner | No | Blocked |
| Reviewer credential delivery | Secrets Owner | Security and QA Owners | No | Blocked |
| Provider suppression | Security Owner | Payments, Messaging, Screening, Signing, and AI Owners | No | Blocked |
| Logging and incidents | Incident Owner | Security Operations and Platform Engineering Owners | No | Blocked |
| Teardown and orphan response | Cleanup Owner | Platform Engineering and Security Owners | No | Blocked |
| Vercel project configuration | Frontend Platform Owner | Security Owner | No | Blocked |

Role labels are not owner assignments. Each row requires an identified person, acknowledgment, delegated backup, and review date.

## Binary Phase B readiness checklist

Phase B is authorized only when every row is `Approved` with linked evidence. `Proposed` and `Blocked` both mean no implementation authorization.

| Gate | Current status | Required owner | Required evidence | Target |
| --- | --- | --- | --- | --- |
| Dedicated project identity and lifecycle | Blocked | Product and Platform Owners | Approved identifier, creation authority, deletion model, labels | Before authorization |
| Montréal region and service compatibility | Proposed | Platform and Privacy Owners | Current service availability and privacy approval | Before authorization |
| Billing limits and response ownership | Blocked | Billing Owner | Approved amounts, alert recipients, pause/resume test plan | Before authorization |
| Authenticated Vercel-to-Cloud-Run ingress | Blocked | Security and Frontend Platform Owners | Exact claim and token-exchange proof | Before authorization |
| WIF trust and least-privilege identities | Blocked | IAM and Security Owners | Reviewed claims, conditions, roles, negative tests | Before authorization |
| Terraform state isolation | Blocked | Infrastructure State Owner | Workspace, access, locking, recovery, and apply evidence | Before authorization |
| Provider inventory and suppression | Blocked | Security and domain owners | Complete inventory and fail-closed test plan | Before authorization |
| Synthetic-only data and seed contract | Blocked | QA Data and Privacy Owners | Dataset specification, provenance, reset and deletion evidence | Before authorization |
| Credential delivery and revocation | Blocked | Security and QA Owners | Approved mechanism and lifecycle proof | Before authorization |
| Logging, redaction, access, and retention | Blocked | Security Operations and Privacy Owners | Logging schema, access list, retention and deletion proof | Before authorization |
| Teardown identity and orphan controls | Blocked | Platform and Security Owners | Idempotent teardown and residual-resource test plan | Before authorization |
| Exact-head integrity and provenance | Blocked | Release Engineering Owner | Immutable image/digest mapping and verification plan | Before authorization |
| Phase B implementation scope approval | Blocked | Product, Security, Platform, and Billing Owners | Signed scope and exclusions | Before authorization |

## Security risk closure table

| Risk | Current decision | Residual gap | Required owner/evidence | Effect |
| --- | --- | --- | --- | --- |
| Public backend exposure | Prefer protected Vercel proxy and authenticated Cloud Run | Identity exchange unproven | Security-approved end-to-end proof | Blocks Phase B |
| Fork or untrusted workflow identity | Deny forks and unapproved workflows | Exact claims/conditions untested | IAM negative-test evidence | Blocks Phase B |
| Static cloud credentials | Prohibited | No deployed WIF configuration exists | WIF proof and key inventory | Blocks Phase B |
| Production state/resource collision | Dedicated project and state required | Ownership and state workspace unconfirmed | Project and workspace approvals | Blocks Phase B |
| Provider side effects | Deny by default | Inventory and tests incomplete | Provider suppression evidence | Blocks Phase B |
| Sensitive or production data | Synthetic only | Dataset and enforcement undefined | Privacy-approved seed contract | Blocks Phase B |
| Credential leakage | Ephemeral secure delivery proposed | Delivery path unapproved | Issuance-to-revocation proof | Blocks Phase B |
| Sensitive logs | Minimal redacted logging proposed | Enforcement and access untested | Redaction and retention evidence | Blocks Phase B |
| Resource or cost leak | Bounded quotas and teardown proposed | Named responders and teardown proof absent | Cost and cleanup evidence | Blocks Phase B |
| Overprivileged cleanup | Separate manifest-scoped identity proposed | Roles and manifest integrity untested | IAM and teardown negative tests | Blocks Phase B |
| Misleading exact-head preview | Immutable commit-to-image mapping required | Provenance flow not implemented | Digest and deployment-attestation evidence | Blocks Phase B |

## Refined Phase B scope, if later authorized

Phase B would be limited to the smallest secure infrastructure foundation needed to prove the architecture:

- dedicated preview project and approved labels;
- isolated Terraform Cloud workspace and state controls;
- required APIs and narrowly scoped identities;
- workload identity federation for an approved GitHub workflow;
- regional Artifact Registry and authenticated Cloud Run shell service;
- protected Vercel preview-to-backend identity proof;
- synthetic seed and teardown primitives;
- provider-deny configuration and verification;
- logging, cost alerts, quotas, and orphan detection; and
- exact-head provenance and automated security tests.

Phase B would still exclude production data, production credentials, public backend access, provider-backed email, payments, PAD, screening, signing, AI execution, webhooks, financial mutations, permanent application feature work, broad IAM, multi-region resilience, and changes to RC1 behavior.

## Decision and holds

**Further design work required.**

The architecture direction is credible, and Montréal is the recommended region. However, ingress identity exchange, WIF policy, project and state ownership, provider suppression, credential delivery, logging, cost approval, and teardown ownership remain unresolved or unproven. These are mandatory Phase A decisions, not Phase B implementation details.

No Phase B branch should be opened until the binary checklist is fully approved. PR #1435 must remain draft and blocked pending an exact-head preview environment. Operational Credits must remain paused unless separately reauthorized.

## Validation plan for this decision record

- Confirm the diff contains exactly this docs-only strategy file.
- Confirm all required decision areas are present.
- Confirm the document contains no credential, secret, executable deployment instruction, runtime change, or production-resource mutation.
- Confirm Phase B is not authorized and all unresolved controls are visibly blocking.
- Run whitespace validation for working and staged diffs.
- Run competitor-name, secret-pattern, execution-command, link/path, and protected-scope scans.
- Confirm the branch is synchronized and the working tree is clean after publication.

## References

- [Reusable preview architecture decision](../architecture/reusable-preview-architecture-decision-v1.md)
- [Reusable preview threat model](../security/reusable-preview-threat-model-v1.md)
- [Reusable preview IAM and access model](../security/reusable-preview-iam-and-access-model-v1.md)
- [Reusable preview provider suppression](../security/reusable-preview-provider-suppression-v1.md)
- [Reusable preview cost and cleanup controls](../deployment/reusable-preview-cost-and-cleanup-controls-v1.md)
- [Reusable preview Phase B readiness](../deployment/reusable-preview-phase-b-readiness-v1.md)
- [Google Cloud Run locations](https://cloud.google.com/run/docs/locations)
- [Google Cloud Firestore locations](https://cloud.google.com/firestore/docs/locations)
- [Google Artifact Registry locations](https://cloud.google.com/artifact-registry/docs/repositories/repo-locations)
- [Google Secret Manager locations](https://cloud.google.com/secret-manager/docs/locations)
- [Google workload identity federation for deployment pipelines](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [Vercel OIDC](https://vercel.com/docs/oidc)
