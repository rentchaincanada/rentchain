# Reusable Preview Infrastructure Phase A Blocker Resolution v1

## Executive summary

This record converts the remaining reusable-preview Phase A uncertainties into explicit decisions, assignments, proof obligations, deferrals, and hard blockers. It does not authorize Phase B, cloud provisioning, deployment, operator access, production integration, or provider execution.

The proposed foundation remains a permanent, isolated `rentchain-preview-staging` Google Cloud and Firebase project in Montréal. The platform documentation supports Vercel-issued short-lived OIDC identity, Google Cloud workload identity federation, and authenticated Cloud Run invocation. RentChain has not yet proven the exact Vercel-to-Google exchange, token audience, deployment claims, or protected-preview behavior in its own projects.

The final section recommends only a separately authorized, temporary, non-production identity-feasibility activity. Phase B remains blocked by named owner assignments and the technical and operational gates in this document.

## Scope and explicit non-authorization

This is a docs-only feasibility and approval package. It creates no project, billing link, Terraform workspace, service account, identity pool, secret, credential, Firebase user, Firestore document, storage object, Cloud Run service, Vercel configuration, route, job, or application behavior.

PR #1435 remains draft and blocked. Operational Credits Phase 1A remains paused. No feasibility spike or Phase B work may begin without separate operator authorization.

## Decision classification

Every item uses one of these classifications:

| Classification | Meaning |
| --- | --- |
| Approved decision | Architecture direction is settled; implementation still requires mission authorization |
| Assigned owner confirmation required | A role is defined but an identified person has not accepted accountability |
| Technical feasibility proof required | Platform capability is plausible but RentChain-specific evidence is absent |
| Explicitly deferred non-blocker | Not needed for the next bounded decision and cannot silently enter scope |
| Hard blocker preventing Phase B | Phase B cannot begin until the item is approved with evidence |

## Project-creation authorization record

The proposed project display name is **RentChain Preview Staging**. The proposed project identifier is `rentchain-preview-staging`, subject to global availability. If unavailable, the Cloud Project Owner must approve a deterministic non-sensitive suffix before creation. The Firebase project uses the same Google Cloud project and identifier; it is not a second project.

The project is a permanent shared non-production foundation. Preview revisions, synthetic datasets, sessions, temporary secrets, and evidence artifacts remain short-lived. It must be placed in an approved non-production organization folder and must not inherit production credentials, datasets, IAM groups, Terraform state, network paths, or provider configuration.

| Responsibility | Accountable role | Authority | Current classification |
| --- | --- | --- | --- |
| Business purpose and lifecycle | Business Owner | Approves project purpose, lifecycle, and Phase B scope | Assigned owner confirmation required |
| Technical delivery | Technical Owner | Approves architecture and implementation acceptance | Assigned owner confirmation required |
| Billing | Billing Owner | Links approved billing account, receives alerts, pauses/resumes spend, approves increases with Business Owner | Assigned owner confirmation required |
| Security | Security Approver | Approves ingress, credential delivery, logging, provider suppression, and exceptions | Assigned owner confirmation required |
| IAM | IAM Approver | Grants IAM, approves WIF mappings and identities, revokes access | Assigned owner confirmation required |
| Infrastructure and state | Infrastructure Owner | Owns Terraform workspace, plans, locks, recovery, and destruction | Assigned owner confirmation required |
| QA | QA Owner | Approves synthetic fixtures, evidence, and authenticated QA completion | Assigned owner confirmation required |
| Secrets | Secrets Owner | Approves retrieval, delivery, expiry, rotation, and revocation | Assigned owner confirmation required |
| Cleanup | Cleanup Owner | Owns automated teardown and residual-resource verification | Assigned owner confirmation required |
| Manual recovery | Manual Recovery Owner | Resolves partial teardown and orphaned resources | Assigned owner confirmation required |
| Incident response | Incident Owner | Acts as incident commander and coordinates escalation | Assigned owner confirmation required |
| Preview deployment | Preview Operator | May trigger an approved preview deployment within manifest scope | Assigned owner confirmation required |

Required authorization rules:

- project creation requires Business Owner, Billing Owner, Security Approver, and Infrastructure Owner approval;
- project deletion requires Business Owner and Infrastructure Owner approval, Security review, and a verified evidence export/deletion plan;
- IAM grants require IAM Approver approval and Security review;
- budget increases require Billing Owner and Business Owner approval;
- public ingress requires an explicit time-bounded Security exception; authenticated ingress requires Security Approver approval;
- preview deployments may be triggered only by the Preview Operator or the approved protected workflow;
- seeded credentials may be retrieved only by an approved QA reviewer through the Secrets Owner's approved delivery mechanism; and
- one person may hold multiple roles only after documenting separation-of-duties risk and an independent reviewer for their approvals.

Role labels are not assignments. Phase B is blocked until each role has an identified person, backup, acknowledgment date, and review date.

## Project and billing prerequisites

| Prerequisite | Proposed decision | Status | Owner/evidence required |
| --- | --- | --- | --- |
| Globally unique project ID | Prefer `rentchain-preview-staging`; approve deterministic suffix if unavailable | Technically unverified | Cloud Project Owner records availability immediately before creation |
| Billing account | Dedicated approved non-production charge path | Blocked | Billing Owner identifies account without documenting account numbers publicly |
| Billing owner | Named accountable person and backup | Blocked | Written acceptance |
| Monthly budget | CAD 100 | Pending named approval | Billing Owner and Business Owner approval |
| Budget alerts | 50%, 80%, and 100% | Pending named approval | Named recipients and acknowledgment test |
| Abnormal daily-spend alert | CAD 15 | Pending named approval | Billing Owner and Incident Owner acceptance |
| Deployment pause | Mandatory at monthly budget exhaustion or unresolved abnormal spend | Approved decision | Enforcement design remains Phase B work |
| Pause authority | Billing Owner, Security Approver, or Incident Owner | Pending named approval | Named roles and escalation record |
| Resume authority | Billing Owner and Security Approver jointly | Pending named approval | Named roles and documented review |
| Temporary budget increase | Billing Owner and Business Owner jointly, with expiry | Pending named approval | Named roles and bounded increase record |
| Labels | `environment=preview`, `system=rentchain`, `managed-by=terraform`, `cost-centre=preview-qa`, `data-classification=synthetic`, `lifecycle=permanent-foundation` | Approved decision | Infrastructure plan evidence |
| Cost-centre metadata | `preview-qa`, subject to Finance naming confirmation | Pending named approval | Billing Owner confirmation |
| Organization/folder placement | Governed non-production folder; no production project placement | Blocked | Cloud Project Owner supplies folder-policy evidence |
| Deletion protection | Enabled for permanent foundation; temporary spike resources excluded but expiry-bound | Pending named approval | Infrastructure and Security approval |
| Resource lifetime | Application preview and spike resources maximum 24 hours unless separately approved | Approved decision | Teardown evidence |
| Image retention | 14 days, maximum three relevant revisions | Pending named approval | Technical and Billing Owners |
| Temporary storage | Maximum 100 MiB per run | Pending named approval | Security and Billing Owners |
| Operational logs | 7 days | Pending named approval | Security and Privacy reviewers |
| Non-sensitive audit metadata | 30 days | Pending named approval | Security and Privacy reviewers |

Budget alerts are not hard spending caps. Instance limits, deployment pause, resource quotas, lifecycle policies, and teardown remain mandatory compensating controls.

## Region decision

**Approved architecture decision:** use `northamerica-northeast1` (Montréal) as the initial region, subject to named Platform, Security, and Privacy approval before provisioning.

| Service | Region position | Limitation or split implication |
| --- | --- | --- |
| Cloud Run | Montréal regional service | Exact service and audience are regional-resource-specific |
| Firestore | Montréal regional database | Database location is effectively permanent; approve before creation |
| Artifact Registry | Montréal regional repository | Co-location reduces image-transfer latency and egress |
| Cloud Storage | Montréal regional bucket for temporary preview objects | No production bucket reuse; lifecycle and deletion required |
| Secret Manager | User-managed regional replication in Montréal where supported | Secret metadata/control plane must not be described as wholly regional without provider confirmation |
| Cloud Build | Montréal is supported | Build pool and source handling require separate implementation review |
| Firebase Authentication | Project-isolated but not represented here as a Montréal-resident service | Privacy review must assess provider terms; do not claim full regional co-location |
| Cloud Logging and Monitoring | Use preview-project telemetry with configured retention | Control-plane and service processing may not be wholly Montréal-resident; document current provider terms before implementation |

Official service catalogs support Montréal for [Cloud Run](https://cloud.google.com/run/docs/locations), [Firestore](https://cloud.google.com/firestore/docs/locations), [Artifact Registry](https://cloud.google.com/artifact-registry/docs/repositories/repo-locations), [Secret Manager](https://cloud.google.com/secret-manager/docs/locations), and [Cloud Build](https://cloud.google.com/build/docs/locations). Availability must be revalidated immediately before implementation.

Multi-region deployment, Toronto failover, and production-region alignment are explicitly deferred non-blockers for the bounded feasibility spike. They remain outside Phase B unless separately approved.

## Vercel-to-Cloud-Run feasibility study

Vercel documents protected Preview deployments and short-lived OIDC tokens that external clouds can exchange for short-lived credentials. Google Cloud documents OIDC workload identity federation and requires a Google-signed ID token whose audience matches the authenticated Cloud Run service URL or configured custom audience. These platform capabilities establish plausibility, not RentChain-specific proof. References: [Vercel OIDC](https://vercel.com/docs/oidc), [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication), [Google workload identity federation](https://cloud.google.com/iam/docs/workload-identity-federation), and [Cloud Run service-to-service authentication](https://cloud.google.com/run/docs/authenticating/service-to-service).

### Option A — Vercel same-origin proxy with authenticated Cloud Run

| Dimension | Assessment |
| --- | --- |
| Request/browser flow | Browser calls a same-origin Vercel server-side endpoint; no cloud identity enters browser code |
| Server flow | Vercel endpoint obtains short-lived identity, obtains a Google-signed ID token, and calls Cloud Run |
| Issuer and audience | Initial issuer is Vercel; federation audience identifies the Google provider; final ID-token audience is the Cloud Run URL or approved custom audience |
| Identity exchange | Occurs only in the Vercel server-side execution environment |
| Secret requirement | No static cloud secret; only approved non-secret identifiers/configuration |
| Long-lived credential | Not required if federation and impersonation work as designed |
| Vercel compatibility | Platform-compatible with Preview/OIDC; RentChain project configuration unverified |
| Protected deployment compatibility | Plausible, but protection session and serverless invocation interaction must be tested |
| Browser API compatibility | Strong: same-origin avoids browser possession of cloud token and minimizes CORS |
| CORS | Not required between browser and proxy; proxy-to-Cloud-Run is server-to-server |
| Replay and lifetime | Audience-bound short-lived tokens reduce replay; actual lifetimes and caching must be captured |
| Log exposure | Token headers and assertions must be redacted at Vercel and Google layers |
| Operations/cost | Moderate; proxy and federation configuration require ownership but no separate gateway service |
| Failure behavior | Missing, invalid, expired, wrong-environment, or wrong-audience identity must fail closed |
| Teardown | Remove temporary service, federation bindings, proxy configuration, grants, logs per retention, and images |
| Approval evidence | Exact claims, exchange trace without token values, Cloud Run IAM denial/allow results, SHA/revision correlation, protected-preview test |

### Option B — direct Vercel OIDC exchange for Google identity

| Dimension | Assessment |
| --- | --- |
| Request/browser flow | Browser still calls server-side Vercel code; a Vercel OIDC token must never be exposed to browser JavaScript |
| Server flow | Vercel runtime presents its OIDC token to Google Security Token Service, then obtains or impersonates identity capable of minting the Cloud Run audience token |
| Issuer and audience | Vercel team issuer; provider-specific exchange audience; final Google-signed Cloud Run audience |
| Identity exchange | Vercel server-side runtime to Google Security Token Service |
| Secret/long-lived credential | Neither should be required |
| Compatibility | Vercel and Google document the primitives; exact two-step Cloud Run ID-token flow is unproven in RentChain |
| Browser/CORS | Safe only behind same-origin server code; direct browser exchange is rejected |
| Replay and lifetime | Strong if custom audience, immutable deployment claims, and short caching are enforced |
| Log exposure | High consequence if raw assertion or exchanged token is logged; mandatory redaction |
| Operations/cost | Lower infrastructure count than a broker, but IAM and token mechanics are intricate |
| Failure behavior | Deny on wrong team, project, environment, deployment, audience, or expired token |
| Teardown | Remove WIF provider/bindings if spike-scoped and delete temporary Cloud Run resources |
| Approval evidence | Captured non-sensitive claim names, exact mapping/condition tests, token minting result, denial matrix |

Option B describes the identity mechanism inside the preferred Option A request architecture. It is separated here because the exchange itself is the unproven technical dependency.

### Option C — bounded public Cloud Run endpoint

| Dimension | Assessment |
| --- | --- |
| Request/browser flow | Protected browser calls a public preview-only backend directly or through the proxy |
| Server flow | Application authentication enforces synthetic-user scope; Cloud Run IAM does not protect ingress |
| Issuer and audience | Firebase or application session issuer/audience; no Cloud Run IAM identity at ingress |
| Secret/long-lived credential | Cloud key not required, but application credential/session delivery is required |
| Compatibility | Technically straightforward; protected Vercel access does not itself protect the public backend URL |
| CORS | Exact approved preview origin only; branch URL churn complicates safe allowlisting |
| Replay and lifetime | Higher exposure; short application sessions, rate limits, and server-side authorization required |
| Log exposure | Public probing and auth failures increase log volume and sensitive-data risk |
| Operations/cost | Lower identity complexity but higher security monitoring and abuse risk |
| Failure behavior | Deny unknown origin, missing/invalid auth, wrong project, over-limit traffic, and expired environment |
| Teardown | Public binding must be removed first; service, sessions, routes, and artifacts deleted within 24 hours |
| Approval evidence | Security exception, external reachability test, auth/CORS/rate-limit negative tests, cost and expiry proof |

This option is a fallback only. It is not approved for the feasibility spike or Phase B.

### Option D — separate preview gateway or broker

| Dimension | Assessment |
| --- | --- |
| Request/browser flow | Browser calls protected Vercel; Vercel calls a dedicated gateway that authenticates and forwards to private Cloud Run |
| Server flow | Gateway validates Vercel identity and mints or obtains the downstream Cloud Run identity |
| Issuer and audience | Vercel issuer to gateway audience, then Google-signed token to Cloud Run audience |
| Secret/long-lived credential | Avoidable with federation; gateway requires its own service identity |
| Compatibility | Technically plausible but introduces an additional service, policy boundary, and failure domain |
| Browser/CORS | Same-origin browser path remains possible |
| Replay and lifetime | Can centralize replay controls but adds token-handling surface |
| Log exposure | Two server layers require consistent redaction |
| Operations/cost | Highest of the four options; added deployment, monitoring, teardown, and incident burden |
| Failure behavior | Fail closed at both gateway and Cloud Run; partial availability is more complex |
| Teardown | Gateway, downstream service, bindings, revisions, images, and logs require coordinated cleanup |
| Approval evidence | Only reconsider if direct exchange is proven infeasible, with a new threat model and cost approval |

Option D is explicitly deferred and must not be introduced during the bounded spike.

### Ingress recommendation

Use **Option A with the Option B federation mechanism** as the proposed target: a Vercel same-origin server-side proxy exchanges a short-lived Vercel OIDC assertion through Google workload identity federation, obtains an audience-bound Google-signed ID token, and invokes authenticated Cloud Run. No token crosses into browser code and no static service-account key is stored.

Status: **Technical feasibility proof required; hard blocker preventing Phase B.**

## Bounded Vercel-to-Cloud-Run feasibility spike specification

The spike is a separate future mission. It proves identity transport only and must not deploy RentChain application code or data services.

| Item | Bound |
| --- | --- |
| Purpose | Prove a trivial Vercel Preview server-side endpoint can use approved short-lived identity to call authenticated non-production Cloud Run |
| Temporary resources | One minimal non-production Cloud Run hello service, one temporary image/repository scope if needed, narrowly scoped WIF provider/binding or approved isolated test equivalent, one Vercel Preview server endpoint/configuration, deployment metadata record |
| Prohibited resources | Firestore, Firebase Auth, Storage data, production project/services, provider integrations, customer data, static keys, broad service accounts |
| Maximum lifetime | 24 hours from first resource creation |
| Maximum incremental cost | CAD 10, with CAD 5 notification and immediate pause at CAD 10 |
| Owner | Named Technical Owner; Security Approver and Billing Owner are mandatory approvers |
| Approval gates | Non-production project confirmed, named owners assigned, exact resource manifest approved, cost approved, logging/redaction approved, teardown identity approved |
| Success | Protected Vercel deployment SHA calls expected authenticated Cloud Run revision; intended audience accepted; invalid/missing/wrong-audience identity denied; no static key; no token in browser/logs; teardown verified |
| Failure | Any production crossover, public invocation, static credential, token disclosure, unexpected claim acceptance, unbounded resource, provider/data access, cost breach, or residual resource |
| Evidence | Exact Vercel deployment SHA, Cloud Run revision and image digest, non-sensitive issuer/audience/claim-name summary, allow/deny status matrix, timestamps, cost snapshot, resource manifest, teardown and residual-resource results |

Teardown sequence is conceptual, not an execution procedure: revoke temporary access and sessions; remove Vercel spike configuration; remove public access if any accidental binding is detected; delete the hello service and revisions; delete temporary image artifacts; remove spike-scoped federation bindings/provider when approved; verify the manifest has no residual resources; retain only approved non-sensitive evidence.

The spike must stop immediately on any failure criterion. A successful spike closes only the Vercel-to-Cloud-Run feasibility gate; it does not authorize Phase B.

## GitHub-to-Google workload identity trust proposal

Static service-account keys are prohibited. Deployment, seed, and teardown use separate least-privilege identities. The proposed trust model follows Google's guidance to use immutable claims and restrictive workload-identity attribute conditions.

### Proposed mappings

| Google attribute | GitHub assertion source | Use |
| --- | --- | --- |
| `google.subject` | `sub` | Auditable unique external subject |
| repository | immutable `repository_id` plus readable `repository` | Bind trust to `rentchaincanada/rentchain` and its immutable ID |
| owner | immutable `repository_owner_id` plus readable `repository_owner` | Bind trust to the RentChain organization |
| workflow | `job_workflow_ref` | Require the approved workflow file pinned to protected `main` |
| ref | `ref` | Limit branch/ref context |
| environment | `environment` where emitted | Require the protected preview deployment environment |
| event | `event_name` | Reject prohibited event types |

### Proposed acceptance logic

The provider accepts an assertion only when all of these statements are true:

```text
repository owner is rentchaincanada and immutable owner ID matches the approved record
repository is rentchaincanada/rentchain and immutable repository ID matches the approved record
workflow identity equals the approved workflow file at refs/heads/main
environment equals the protected preview environment
event is an explicitly allowed deployment event
ref is an approved protected branch or separately approved exact PR-head context
token audience equals the exact workload identity provider audience
assertion did not originate from a fork
```

Prohibited events include `pull_request_target`, fork-origin pull requests, unapproved reusable workflows, arbitrary workflow dispatch by unauthorized actors, and any event without protected-environment approval. The actual claim set must be captured from GitHub and tested because claim availability varies by event.

Deployment identity may create/update only approved preview compute and artifacts. Seed identity may create/delete only manifest-scoped synthetic preview records and users after later authorization. Teardown identity may delete only manifest-scoped preview resources. None may administer the project, billing, IAM pool, or production resources.

Token lifetime must use the shortest platform-supported practical duration and may not be extended through stored refresh credentials. Audit logs retain subject, repository/workflow identifiers, target identity, action category, and outcome without raw tokens.

Break glass requires MFA, named Security and IAM approval, supervised service-account impersonation, a maximum one-hour grant, incident record, and immediate revocation review. Revocation disables the provider or binding, revokes grants, pauses deployments, invalidates sessions where possible, and verifies no static keys exist.

Status: **Approved design; named owner confirmation and technical proof required; hard blocker preventing Phase B.**

## Terraform state decision

Use a dedicated Terraform Cloud workspace proposed as `rentchain-preview-staging`. It must not share production state, variable sets containing production secrets, apply identities, run triggers, or broad team permissions.

| Control | Decision | Unresolved assignment |
| --- | --- | --- |
| Terraform Cloud organization | Use the existing governed RentChain organization only after its exact identity and policy are confirmed | Infrastructure Owner |
| Workspace owner | Named Infrastructure Owner with backup | Unassigned |
| Plan authority | Approved engineering contributors and protected automation may request plans | Named access list missing |
| Apply authority | Protected workflow plus explicit Infrastructure Owner approval; no general contributor applies | Apply owner missing |
| Unlock authority | Infrastructure Owner with Security notification and audit record | Named owner missing |
| Destroy authority | Infrastructure Owner plus Business and Security approval | Named owners missing |
| State separation | Dedicated workspace and state; no production sharing | Approved decision |
| Variables | Preview-only variable set; sensitive values stored only in approved sensitive workspace variables or secret system | Mechanism unapproved |
| Locking | Mandatory exclusive state locking; concurrent apply denied | Evidence missing |
| Plan review | Human review of resource scope, IAM, public access, costs, deletion, and production references | Reviewer missing |
| Recovery | Tested state-version recovery and documented ownership | Evidence missing |
| Audit | Retain non-sensitive run actor, plan/apply outcome, approval, and state-version metadata | Retention approval missing |
| Deletion | Revoke apply access, verify resource teardown, retain approved audit evidence, then delete workspace with dual approval | Owners missing |
| Project bootstrap | Prefer a separately approved bootstrap process for project and initial state identity; do not create circular state authority | Final design unresolved |

Repository checks demonstrate a Terraform Cloud integration, but source files do not prove the workspace organization, access, locking, encryption, recovery, or apply authority. Sensitive outputs must never be printed to PRs or ordinary logs.

Status: **Hard blocker preventing Phase B until state owner and apply authority are named and evidence is approved.**

## Repository-grounded provider inventory

Missing configuration is not accepted as complete suppression unless the initialization and every relevant call path fail closed. Outbound network access should be denied by default and allowlisted only for approved infrastructure endpoints.

| Provider/category | Repository evidence and variables | Current fallback | Preview mode and required automated proof | Owner/residual risk | Status |
| --- | --- | --- | --- | --- | --- |
| Stripe | `rentchain-api/src/services/stripeService.ts`, `src/config/requiredEnv.ts`, `src/config/planMatrix.ts`, billing, public, payment, and webhook routes; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `STRIPE_MODE`, `STRIPE_ENV` | Some paths report unconfigured; configured paths can construct clients and mutate billing/payment state | Blocked plus network-denied; startup, route, webhook, intent, subscription, and mutation tests must prove no client or outbound request | Payments Owner; broad route surface remains | Hard blocker |
| TransUnion/screening | `src/services/integrations/transunion/`, screening services/routes, `transunionWebhookRoutes.ts`; `TRANSUNION_CREDENTIALS_ENCRYPTION_KEY`, `TU_RESELLER_WEBHOOK_SECRET`, `SCREENING_TRANSUNION_ENABLED` and stored provider credentials | Feature flags and missing credentials affect paths, but provider-neutral workflows and callbacks exist | Blocked plus network-denied; referral, credential, callback, webhook, and workflow tests required | Screening Owner; stored configuration and overlapping flows remain | Hard blocker |
| Certn | No active Certn adapter or `CERTN_*` configuration found in audited source | No known initialization path | Explicitly blocked; inventory test must fail if a future Certn client or variable appears without policy | Screening Owner; absence can drift | Hard blocker until inventory guard exists |
| Rotessa | No active Rotessa adapter or `ROTESSA_*` configuration found in audited source | No known initialization path | Explicitly blocked; dependency/configuration inventory guard and network deny | Payments Owner; future integration drift | Hard blocker until inventory guard exists |
| PAD/banking | Payment scheduling and provider-neutral payment surfaces exist; no approved preview bank provider configuration identified | Behavior varies by route/service; not a provider-wide fail-closed guarantee | Block all scheduling, authorization, bank-data, payment, reconciliation, and money-movement mutation; route/service tests required | Payments Owner; high-consequence mutation surface | Hard blocker |
| Mailgun | `src/services/emailService.ts`, tenant notice and Mailgun webhook paths; `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM`, `MAILGUN_WEBHOOK_SIGNING_KEY`, replay window | Core service throws on missing configuration; route-level behavior varies | No-op/blocked plus network-denied; all send and callback paths must return controlled unavailable/denied outcomes | Messaging Owner; multiple paths | Hard blocker |
| SendGrid | Numerous invitation, application, maintenance, messages, screening, tenant portal, and diagnostic routes; `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM`, `FROM_EMAIL`, reply-to variants | Several call sites conditionally skip, throw, or degrade differently | Blocked plus network-denied; inventory-driven test covers every import/client/construction/call site | Messaging Owner; legacy breadth and inconsistent fallback | Hard blocker |
| SMS | No clearly configured SMS client or approved environment variable found in audited paths | No known initialization path | Explicitly blocked; inventory guard for new SDKs/variables and network deny | Messaging Owner; absence may drift | Hard blocker until inventory guard exists |
| Push notifications | No clearly configured external push provider found in audited paths | No known initialization path | Explicitly blocked; inventory guard and network deny | Messaging Owner; absence may drift | Hard blocker until inventory guard exists |
| OpenAI/AI APIs | `src/config/openai.ts`, `src/ai/agent.ts`, `src/ai/aiAgentService.ts`, portfolio AI service; `OPENAI_API_KEY` | Some code warns/fails; `agent.ts` includes a random fallback stub, which is not deterministic proof | Blocked plus network-denied; provider construction denied and all AI surfaces return deterministic unavailable state | AI Owner; inconsistent/random fallback | Hard blocker |
| Document signing | `src/services/signing/providers/`, lease signing and webhook routes; `SIGNING_PROVIDER`, `SIGNING_PROVIDER_API_KEY`, `SIGNING_PROVIDER_WEBHOOK_SECRET`, test mode and callback/return variables | Defaults to mock in provider registry, while external modes exist | Fake/mock-only with deterministic fixture; external providers and callbacks blocked and network-denied | Signing Owner; provider-selection drift | Hard blocker until allowlist test exists |
| Analytics | Internal analytics routes/pages exist; no approved external analytics destination found in audited configuration | Internal computation continues; external egress inventory is incomplete | Internal synthetic-only analytics permitted only if later scoped; external export blocked and network-denied | Privacy Owner; hidden SDK/config drift | Hard blocker until inventory completed |
| Error reporting | No clearly configured external error-reporting provider found in audited paths | Standard logging behavior only | External reporting blocked; dependency/configuration inventory and log redaction tests | Security Operations Owner; accidental SDK introduction | Hard blocker until inventory guard exists |
| Outgoing webhooks | Provider callbacks and webhook receivers exist; application-originated webhook inventory is not proven complete | Route-specific behavior | All external webhook delivery blocked; inbound provider callbacks unavailable; route and egress tests | Security Owner; incomplete route/call inventory | Hard blocker |
| Storage notifications | No approved external storage-triggered notification binding found in audited infrastructure | No known binding | Disabled; infrastructure inventory proves no trigger, Pub/Sub destination, or external notification exists | Infrastructure Owner; out-of-repo configuration risk | Hard blocker |
| Maps/geocoding | No clearly configured maps/geocoding provider found in audited source | No known initialization path | Explicitly blocked; SDK/config inventory guard and network deny | Technical Owner; absence may drift | Hard blocker until inventory guard exists |

Provider inventory result: **no provider is approved for real, sandbox, or external-network execution in preview.** Mock behavior is allowed only for a separately approved deterministic local adapter with no external call. Provider suppression remains a Phase B hard blocker until automated deny-by-default evidence exists.

## Synthetic credential-delivery decision

The proposed mechanism is an approved enterprise password manager with one-time or expiring sharing, using high-entropy per-run synthetic credentials created by the approved seed identity. A short-lived secret-sharing service may be approved as an equivalent fallback. PR comments, CI logs, repository files, screenshots, chat, shared spreadsheets, and long-lived static credentials are prohibited.

| Stage | Required control |
| --- | --- |
| Creation | Seed identity creates only manifest-scoped synthetic users; values are generated per run and never printed |
| Storage | Ephemeral runner memory or protected temporary file with restrictive permissions until delivery; password manager holds only the bounded shared item |
| Delivery | Named Secrets Owner publishes an expiring share to an approved QA reviewer; recipient authentication required |
| Access | Least privilege, named recipient, retrieval event recorded without secret value |
| Expiration | Credential and share expire within 24 hours; application sessions use the shortest practical QA duration and never exceed 24 hours |
| Rotation | New run produces new credentials; suspected exposure triggers immediate replacement |
| Revocation | Disable/delete synthetic user, revoke refresh/session state where supported, invalidate shared item, and record outcome |
| Teardown | Delete synthetic users, temporary credential material, shares, and run-specific access grants; residual check required |
| Audit | Record run ID, synthetic role, creator identity, recipient identity, creation/retrieval/expiry/revocation timestamps, and outcomes only |
| Automated E2E | Future runner receives an ephemeral session through injected secret handling; it must not print or persist the credential |
| Human QA | Reviewer acknowledges handling policy, uses only approved device/session, and does not capture credential-bearing screenshots |
| Incident | Pause QA/deployments, revoke credential/session, notify Incident and Security Owners, inspect access metadata, and document closure |

Alternatives:

- one-time links are acceptable only through an approved secret-sharing service, not preview email;
- temporary Firebase custom tokens require a separately reviewed server-side minting and exchange design and are deferred;
- passwordless email is rejected while email is suppressed;
- operator-generated sessions are deferred because they add impersonation and audit risk.

Status: **Approved proposed mechanism; named Secrets, Security, Privacy, and QA owners plus lifecycle proof required; hard blocker preventing authenticated QA and Phase B.**

## Observability and incident ownership

| Function | Accountable role | Required evidence before QA success | Current status |
| --- | --- | --- | --- |
| Application and Cloud Run logs | Log Owner | Access list, redaction tests, correlation and retention proof | Owner unassigned; blocked |
| Deployment logs and SHA/revision evidence | Deployment Owner | Exact head, image digest, revision, timestamps, outcome | Owner unassigned; blocked |
| Cost alerts | Cost-Alert Owner | Alert recipients, 50/80/100 and CAD 15 delivery acknowledgment | Owner unassigned; blocked |
| Security/auth alerts | Security-Alert Owner | Denial events, suspicious access routing, response test | Owner unassigned; blocked |
| Cleanup alerts | Cleanup-Alert Owner | Failure alert within 15 minutes and acknowledgment path | Owner unassigned; blocked |
| QA evidence | QA Evidence Owner | Signed non-sensitive evidence checklist with failures disclosed | Owner unassigned; blocked |
| Incident command | Incident Owner | Primary/backup, severity model, escalation contacts, pause/revoke authority | Owner unassigned; blocked |

Logs are least-privilege and role-restricted. They may contain non-sensitive run IDs, commit/revision metadata, route class, timestamps, latency, result codes, identity category, policy outcome, resource category, cost threshold, and teardown counts. They must not contain credentials, tokens, raw OIDC assertions, request bodies, provider payloads, financial data, production identifiers, customer data, or raw storage/Firestore paths in reviewer-facing output.

Operational/security logs are retained seven days; non-sensitive cost, teardown, and approval metadata may be retained 30 days after Privacy and Security approval. QA cannot be declared successful until log redaction, access control, alert routing, evidence completeness, and teardown results all pass. Any critical alert, token exposure, production reference, provider egress, or residual resource fails QA and invokes incident response.

## Teardown ownership and contract

Cleanup uses a dedicated least-privilege identity. It may delete only resources in the preview project whose exact resource identifiers and run namespace appear in the integrity-protected manifest created for that run. It cannot delete the permanent project, billing link, WIF administration resources, unrelated runs, or production resources.

Required namespace attributes include environment, run ID, PR or deployment identifier, exact commit SHA, creation timestamp, expiry timestamp, and manifest digest. Delete authorization requires both manifest membership and matching preview labels/namespace; either mismatch fails closed.

Teardown behavior:

- begin immediately when the QA window closes and always before the 24-hour expiry;
- retry transient failures with bounded attempts and idempotent deletion;
- alert Cleanup, Manual Recovery, Security, and Incident Owners within 15 minutes of failure;
- pause new preview creation while unresolved residual resources exist;
- revoke sessions and expiring credential shares;
- delete synthetic Firebase Auth users, Firestore documents, Storage objects, temporary secrets, Cloud Run services/revisions, and Artifact Registry images within manifest scope;
- remove temporary IAM/WIF bindings and Vercel spike configuration when the approved spike manifest includes them;
- perform an independent residual-resource query after automated cleanup; and
- retain only approved non-sensitive deletion and residual-count evidence.

Manual recovery uses separately approved time-limited impersonation, dual review for scope, the same manifest restrictions, and a post-action audit. Maximum orphan lifetime is 24 hours; missing that bound is an incident and blocks further preview deployment.

Status: **Approved contract design; Cleanup Owner and Manual Recovery Owner remain unassigned; hard blocker preventing project creation and Phase B.**

## Final Phase B gate matrix

No row is implicitly approved by this document. `Approved decision` settles design only; gates still requiring owner or proof remain blocking.

| Decision/gate | Status | Owner | Evidence required | Severity | Prevents project creation | Prevents deployment | Prevents authenticated QA | Target closure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Business/project owner | Blocked | Business Owner | Named acceptance and backup | Hard | Yes | Yes | Yes | Before project authorization |
| Billing owner | Blocked | Billing Owner | Named acceptance and alert response | Hard | Yes | Yes | Yes | Before project authorization |
| Security approver | Blocked | Security Approver | Named acceptance and review authority | Hard | Yes | Yes | Yes | Before spike authorization |
| IAM approver | Blocked | IAM Approver | Named acceptance and revocation authority | Hard | Yes | Yes | Yes | Before spike authorization |
| Infrastructure owner | Blocked | Infrastructure Owner | Named workspace/state accountability | Hard | Yes | Yes | Yes | Before project authorization |
| QA owner | Blocked | QA Owner | Named evidence and fixture accountability | Hard | No | Yes | Yes | Before Phase B authorization |
| Secrets owner | Blocked | Secrets Owner | Named credential lifecycle accountability | Hard | No | No | Yes | Before authenticated QA |
| Cleanup/manual recovery owners | Blocked | Cleanup and Manual Recovery Owners | Named acceptance and escalation test | Hard | Yes | Yes | Yes | Before project authorization |
| Incident owner | Blocked | Incident Owner | Named primary/backup and response authority | Hard | Yes | Yes | Yes | Before spike authorization |
| Project ID availability | Technically unverified | Cloud Project Owner | Global availability record | Hard | Yes | Yes | Yes | Immediately before creation |
| Billing account | Blocked | Billing Owner | Approved non-production account linkage | Hard | Yes | Yes | Yes | Before project authorization |
| Budget limits | Pending approval | Billing and Business Owners | CAD 100/CAD 15 and alert approvals | Hard | Yes | Yes | Yes | Before project authorization |
| Montréal region | Approved decision; named approval pending | Platform, Privacy, Security | Current service-location and privacy review | Hard | Yes | Yes | Yes | Before project authorization |
| Ingress model | Technical proof required | Security and Frontend Platform Owners | Bounded spike success evidence | Hard | No | Yes | Yes | Before Phase B authorization |
| Vercel identity feasibility | Technical proof required | Technical and Security Owners | Exact exchange/audience/denial evidence | Hard | No | Yes | Yes | Bounded spike |
| GitHub WIF trust | Design approved; proof required | IAM and Security Approvers | Claims, mappings, conditions, negative tests, revocation | Hard | No | Yes | Yes | Before Phase B authorization |
| Terraform Cloud workspace | Blocked | Infrastructure Owner | Organization, workspace, locking, recovery, access, apply proof | Hard | Yes | Yes | Yes | Before project authorization |
| Provider suppression | Blocked | Security and domain owners | Complete inventory, network deny, initialization/route tests | Hard | No | Yes | Yes | Before Phase B authorization |
| Credential delivery | Proposed; proof required | Secrets, Security, QA, Privacy | Creation-to-revocation evidence | Hard | No | No | Yes | Before authenticated QA |
| Logging/redaction | Blocked | Log, Security, Privacy Owners | Access, retention, redaction, alert tests | Hard | No | Yes | Yes | Before spike/Phase B as applicable |
| Synthetic seed policy | Blocked | QA Data and Privacy Owners | Fixture contract, provenance, reset/deletion proof | Hard | No | Yes | Yes | Before Phase B authorization |
| Teardown policy | Design approved; owners/proof missing | Cleanup, Infrastructure, Security | Idempotency, failure/retry, scope denial, residual proof | Hard | Yes | Yes | Yes | Before project authorization |
| No production crossover | Approved requirement; proof missing | Security and Infrastructure Owners | Project/state/secret/data/provider negative scans | Hard | Yes | Yes | Yes | Before every authorization |
| Phase B scope | Blocked | Business, Technical, Security, Billing | Separately approved mission and gate package | Hard | No | Yes | Yes | After all Phase A gates close |

Gate status: **0 of 24 operational gates fully closed.** Architectural decisions reduce ambiguity but do not substitute for named accountability or test evidence.

## Explicit deferred non-blockers

These items are unnecessary for the bounded spike and may not silently enter it:

- Firestore, Firebase Auth, Storage, synthetic application fixtures, or customer-like workflows;
- production-aligned application deployment;
- multi-region architecture or Toronto failover;
- Certn, TransUnion, Stripe, Rotessa, PAD, email, SMS, signing, AI, analytics, maps, webhooks, or any sandbox integration;
- public preview access;
- automated full multi-role E2E;
- per-PR Google Cloud projects;
- production pipeline, Firebase, Cloud Run, data, or credential changes;
- Operational Credits; and
- changes to PR #1435.

These are deferred non-blockers for the identity-only spike, but many remain hard blockers for Phase B.

## Remaining hard blockers

- all accountable operational roles remain role placeholders;
- the project ID, billing account, folder placement, deletion protection, budget, and retention approvals are unconfirmed;
- the Vercel-to-Google-to-Cloud-Run identity exchange is not proven in RentChain projects;
- GitHub and Vercel claim sets and WIF conditions are untested;
- Terraform Cloud organization, workspace, state owner, access, recovery, and apply authority are unconfirmed;
- external-provider initialization, egress, callback, and mutation suppression lacks comprehensive automated proof;
- synthetic credential delivery is not operationally approved or tested;
- logging, redaction, alert routing, and retention owners are unassigned; and
- cleanup and manual recovery ownership and evidence are absent.

## Final recommendation

**Approved for a bounded Vercel-to-Cloud-Run feasibility spike only.**

This recommendation authorizes no action by itself. A separate operator-approved mission must name the spike owners, confirm a non-production project and billing boundary, approve the CAD 10 spike cap, approve exact temporary resources, and require complete teardown. Successful identity proof would close only the ingress-feasibility gate. Phase B remains unauthorized until every hard gate is closed.

## Validation plan

- Confirm the diff contains exactly this docs-only strategy file.
- Confirm all required ownership, billing, region, ingress-option, spike, WIF, state, provider, credential, observability, teardown, and gate-matrix sections are present.
- Confirm exactly one final recommendation appears and Phase B remains unauthorized.
- Confirm project/resource references are proposed or prohibited, never claims of existing preview infrastructure.
- Confirm no credential values, secret material, executable provisioning instructions, runtime changes, or production mutations are included.
- Run working and staged whitespace validation.
- Run required-section, ownership, numeric-cost, provider, secret-pattern, production-resource, WIF, ingress-flow, Terraform-state, cleanup-owner, link/path, terminology, and protected-scope scans.
- Review consistency against the six Phase A architecture/security/deployment records and the Phase A decision closure.

## References

- [Phase A decision closure](./reusable-preview-phase-a-decision-closure-v1.md)
- [Reusable preview architecture decision](../architecture/reusable-preview-architecture-decision-v1.md)
- [Reusable preview threat model](../security/reusable-preview-threat-model-v1.md)
- [Reusable preview IAM and access model](../security/reusable-preview-iam-and-access-model-v1.md)
- [Reusable preview provider suppression](../security/reusable-preview-provider-suppression-v1.md)
- [Reusable preview cost and cleanup controls](../deployment/reusable-preview-cost-and-cleanup-controls-v1.md)
- [Reusable preview Phase B readiness](../deployment/reusable-preview-phase-b-readiness-v1.md)
- [Vercel OIDC federation](https://vercel.com/docs/oidc)
- [Vercel OIDC reference](https://vercel.com/docs/oidc/reference)
- [Vercel deployment authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [Google workload identity federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Google WIF for deployment pipelines](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google WIF security practices](https://cloud.google.com/iam/docs/best-practices-for-using-workload-identity-federation)
- [Cloud Run service-to-service authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [Cloud Run custom audiences](https://cloud.google.com/run/docs/configuring/custom-audiences)
- [Google Cloud Run locations](https://cloud.google.com/run/docs/locations)
- [Google Firestore locations](https://cloud.google.com/firestore/docs/locations)
- [Google Artifact Registry locations](https://cloud.google.com/artifact-registry/docs/repositories/repo-locations)
- [Google Secret Manager locations](https://cloud.google.com/secret-manager/docs/locations)
- [Google Cloud Build locations](https://cloud.google.com/build/docs/locations)
