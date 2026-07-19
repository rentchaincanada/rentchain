# Phase 1C Receivables Operator Authorization Control Plan v1

Status: control-plan documentation only; human or operator use remains unauthorized, and no execution procedure or runnable entrypoint is approved

## 1. Executive summary

Phase 1A established an unregistered, dependency-injected, test-invoked adapter around the Phase 0W sanitized-file wrapper. Phase 1B confirmed that this software contract does not authorize human use and that package scripts, CLI commands, execution instructions, and runtime registration must remain deferred.

This plan defines the governance evidence that would be required before a future authorization decision could even be considered. It assigns review responsibilities, specifies authorization-request contents, establishes receipt provenance and custody controls, constrains non-financial output, and defines retention, training, escalation, and audit-trail expectations.

This plan does not authorize an operator run. It contains no execution instructions and creates no package script, command, runtime registration, Firestore access, environment access, route, job, UI, or financial output. A complete control package would still require a separate, explicit go/no-go readiness audit and written authorization tied to an exact implementation and operating context.

Tenant rent remains landlord or property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, provider execution, bank data, payment mutation, money movement, custody, pooled funds, landlord payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

The staged accounting foundation includes deterministic receivables projections, landlord-safe DTO assembly, legacy-source normalization, a disabled non-financial comparator, receipt-driven source and readiness cores, the Phase 0U schema-inventory command core, the Phase 0W sanitized-file wrapper, and the Phase 1A injected dev-entrypoint adapter.

These components remain backend accounting-library foundations. They do not expose landlord financial reads, connect to Firestore, run a diagnostic job, or execute payment behavior. Phase 1A is absent from package scripts, the accounting barrel, runtime startup, routes, jobs, schedulers, and user interfaces. Its injected arguments, approved root, output sinks, and fixed non-financial statuses are exercised only by tests using synthetic evidence.

Phase 1B identified governance blockers rather than an implementation defect: no approved operator role, authoritative receipt producer, provenance record, host/root policy, enforceable retention control, or final authorization exists.

## 3. Purpose of the authorization-control plan

The purpose of this plan is to define a consistent evidence and approval model for a future decision. It prevents a safe test seam from becoming an informal support or operations tool merely because it is technically importable.

The plan is intended to:

- assign accountability and separation of duties;
- define what a future authorization request must prove;
- ensure sanitized receipts remain assertions rather than disguised source records;
- constrain file custody and output interpretation;
- require training, acknowledgement, escalation, and deletion controls;
- preserve an append-safe, non-sensitive decision trail; and
- make missing, expired, ambiguous, or conflicting evidence block authorization.

The plan does not design an executable entrypoint or substitute documentation for implemented controls.

## 4. Explicit non-authorization statement

Operator and developer use outside the existing focused tests remains unauthorized.

No person may use this document to justify importing, invoking, wrapping, registering, documenting, or exposing the Phase 1A adapter or Phase 0W wrapper. Repository access, a role title, a merged PR, passing tests, synthetic success, or completion of a checklist is not authorization.

Authorization, if ever granted, must be a later written decision tied to an exact commit, entrypoint version, receipt-contract version, approved evidence class, operator identity, host context, purpose, time window, and revocation terms. Phase 1C grants none of that authority.

## 5. Operator-use risk model

| Risk | Potential impact | Required control posture |
| --- | --- | --- |
| Unapproved person invokes an importable adapter | Unsupported operation and unclear accountability | Named role, explicit grant, expiry, and revocation |
| Sanitized assertions are mistaken for source truth | False schema or readiness conclusion | Governed producer, provenance, independent review, and interpretation limits |
| Receipt contains hidden sensitive or financial data | Privacy, security, and accounting exposure | Exact allowlist, automated rejection, two-person approval, and stop-on-doubt |
| File changes after review | Unreviewed evidence reaches the adapter | Integrity binding and single-session custody |
| Root or host exposes inputs to sync, backup, or credentials | Retention or ambient-access leakage | Approved isolated host and policy-bound ephemeral root |
| Output becomes a pass badge or retained report | Unsupported operational assurance | Full-envelope handling, no-retention default, and prohibited conclusions |
| Command documentation creates de facto authorization | Governance bypass | No execution documentation before final authorization |
| Failure is retried or repaired ad hoc | Evidence manipulation and loss of auditability | Fail closed, stop, preserve minimal incident metadata, require re-review |
| Diagnostic work drifts into payment behavior | Custody, revenue, and regulatory confusion | Non-financial projection and explicit payment/provider exclusions |

Any unresolved risk keeps operator use deferred.

## 6. Required reviewer/sign-off roles

A future authorization package must identify named individuals for each independent role:

- **Request sponsor:** states the bounded business purpose and accepts that the result is non-financial and next-audit-only.
- **Accounting architecture reviewer:** confirms receivables semantics, direct-settlement posture, and the landlord-revenue boundary.
- **Implementation owner:** confirms the exact code, dependency, call-site, package, output, and test boundaries.
- **Security reviewer:** confirms host, root, file, integrity, dependency, exception, and least-privilege controls.
- **Privacy reviewer:** confirms prohibited-data exclusions, data minimization, retention, deletion, and incident handling.
- **Operations governance reviewer:** confirms operator role, separation of duties, training, acknowledgement, stop conditions, and revocation.
- **Receipt preparer:** produces the candidate sanitized receipt through an approved process; cannot be the sole approver or operator.
- **Receipt approver:** independently reviews provenance, content class, integrity, and sanitization before custody transfer.
- **Final authorization owner:** makes the explicit time-bound go/no-go decision after all other evidence is complete.

One person may not act as request sponsor, preparer, approver, operator, and final authorization owner for the same request. Any unavailable, conflicted, or unsigned role blocks authorization.

## 7. Authorization request contents

A future request must be immutable after final review and contain, without embedding sensitive source data:

1. A unique request reference that is not a landlord, lease, tenant, unit, property, payment, provider, or Firestore identifier.
2. The bounded purpose and the question the non-financial classification is intended to inform.
3. The exact repository commit, adapter version, wrapper version, command-core version, and receipt-contract version.
4. The permitted evidence classification, explicitly distinguishing synthetic from any future source-derived receipt.
5. The proposed operator identity, role, approved host class, root policy, and authorized time window.
6. Named preparer, independent approver, reviewers, and final authorization owner.
7. Provenance, integrity, sanitization, completeness, custody, retention, deletion, and incident-control evidence references.
8. The expected fixed output fields and fixed failure categories.
9. The prohibited conclusions and acknowledgement version accepted by the operator and sponsor.
10. Expiry, revocation, stop, escalation, and reauthorization conditions.
11. Test and static-scan evidence tied to the exact commit.
12. An explicit statement that no Firestore, environment, provider, payment, bank-data, money-movement, or financial-output behavior is requested.

Missing, stale, mutable, self-approved, or ambiguous request content causes a no-go decision.

## 8. Receipt provenance controls

Synthetic fixtures remain the only currently approved evidence. Before source-derived receipts can be considered, a separately audited deterministic producer must establish:

- producer identity and version;
- approved source class and bounded evidence window;
- authoritative ownership and exact-scope proof;
- complete-query, pagination, consistency, and no-catch-to-empty assertions;
- field-level allowlisting and redaction before receipt construction;
- confirmation that raw records, identifiers, paths, credentials, environment values, provider payloads, personal data, bank data, and financial amounts never enter the receipt;
- preparer and independent approver attribution outside the receipt body;
- a content-integrity value bound to the approved file without revealing its contents; and
- one-way custody from approval to use, with no enrichment, repair, or reinterpretation by the adapter.

Manual transcription, screenshots, copied logs, database exports, provider exports, raw documents, and ad hoc scripts are prohibited provenance mechanisms. The Phase 1A adapter cannot establish or repair provenance.

## 9. Sanitized receipt-file approval controls

Before any candidate file could be accepted, the preparer and independent approver must confirm:

- the exact supported manifest and receipt versions;
- the complete required receipt-category set and exact allowlisted keys;
- readiness assertions and aggregates only, with no record-level data;
- no identifiers, document or storage paths, credentials, secrets, environment values, personal information, bank/provider data, or financial values;
- no balances, charges, payments, allocations, rent roll, aging, schedules, or tenant balances;
- successful Phase 0W shape, size, unsafe-content, and file-type gates using synthetic validation evidence only until a real workflow is separately approved;
- content integrity is unchanged after independent approval;
- approval is time-bound and invalidated by any modification, transfer anomaly, or version mismatch; and
- rejection cannot be overridden, repaired during use, or replaced with an alternate file without a new preparation and approval cycle.

The approval record must contain only non-sensitive control metadata. It must not duplicate the receipt body or source evidence.

## 10. Approved-root and file-handling controls

No root or host is approved by Phase 1C. A future authorization must define a narrow policy-bound context with:

- a reviewed local host class that does not rely on production, preview, staging, emulator, cloud, or ambient credential access;
- one ephemeral session-specific root outside the repository, home root, downloads, shared, synchronized, indexed, or automatically backed-up locations;
- one explicit relative JSON file beneath that root;
- regular-file-only handling with traversal, symlink, non-regular file, archive, URL, stdin, inline input, glob, discovery, and fallback paths rejected;
- least-privilege local permissions for the shortest authorized interval;
- integrity verification before custody transfer and before any future approved use;
- no file modification between approval and use;
- no output file or locally generated report; and
- verified disposal of the entire session root when the review window ends.

If the host, root, permission, custody, backup, or integrity condition cannot be proven, the file must not be used.

## 11. Output handling controls

The only candidate output remains the complete bounded Phase 0U non-financial envelope or a fixed non-sensitive Phase 1A failure code. A future operator-facing layer must not add paths, arguments, host details, identity details, receipt content, record counts, raw exceptions, source metadata, provider information, or financial values.

Output handling must:

- preserve status, warnings, reason codes, required next steps, checked-at semantics, and receipt-summary limitations together;
- prevent transformation into a pass badge, score, financial report, operational approval, or accounting assurance statement;
- prohibit redirection, piping, screenshots, clipboard retention, ticket/chat posting, telemetry, and unapproved logging;
- map unexpected behavior to a stop condition without revealing raw data; and
- require the operator to report only the separately approved minimal decision metadata, never the envelope itself.

An empty reason list or `ready_for_next_audit` must never be communicated without its provenance and interpretation limitations.

## 12. Retention and deletion controls

Default policy: retain neither receipt input nor adapter output beyond the single approved review session.

A future control implementation must account for temporary storage, editors, shell history, terminal capture, clipboard managers, crash reports, endpoint telemetry, indexing, synchronized folders, backups, screenshots, tickets, chat, email, and CI artifacts. It must define who verifies disposal, when disposal occurs, and what happens if deletion cannot be proven.

Only minimal non-sensitive authorization and decision metadata may be considered for retention, and only after a separate retention design defines purpose, fields, access, encryption, location, duration, deletion proof, legal hold, incident response, and audit access. Raw input, full output, financial data, sensitive paths, source evidence, and provider data remain prohibited.

Failure to meet deletion timing or proof requirements automatically revokes the candidate authorization and triggers escalation.

## 13. Operator training and acknowledgement requirements

Before a future authorization, the named operator must complete version-specific training and acknowledge in writing that:

- technical access is not authority and the workflow may be used only within the exact approved request;
- the receipt and output are non-financial assertions for a next audit, not source truth or operational proof;
- no alternate file, ad hoc correction, retry, fallback, command, test edit, or temporary call site is allowed;
- no Firestore, environment, credential, provider, payment, bank-data, or money-movement access is permitted;
- output must not be retained, redirected, summarized as a pass, or disclosed outside the approved review group;
- every validation failure, provenance gap, unexpected field, dependency access, or deletion problem is a stop condition;
- the authorization expires and can be revoked immediately; and
- tenant rent is landlord/property-manager revenue, not RentChain revenue, and RentChain is not represented as holding or settling rent funds.

Training completion is necessary but not sufficient for authorization. Material changes to code, controls, roles, or interpretation require retraining and renewed acknowledgement.

## 14. Prohibited conclusions from non-financial output

No operator, sponsor, reviewer, or downstream reader may conclude that:

- Firestore, an emulator, production, preview, or staging was inspected;
- receipt assertions are authoritative, current, complete, or independently true merely because their shape passed;
- schema, indexes, IAM, ownership, pagination, consistency, redaction, migration, rollout, rollback, or an adapter is operationally ready;
- a route, job, scheduler, UI, landlord financial read, or deployment may proceed;
- any balance, charge, payment, allocation, rent roll, aging result, receivable schedule, or tenant balance is correct;
- the output is a compliance attestation, audit certificate, accounting assurance, or production-readiness approval;
- payment collection, PAD, provider execution, reconciliation, settlement, custody, or money movement is enabled; or
- tenant rent is RentChain revenue or RentChain holds, pools, custodies, or owes payout of landlord funds.

At most, a future authorized operator could state that the approved receipt assertions were classified under the exact reviewed software contract and require the next human audit gate.

## 15. Escalation and incident-handling expectations

The workflow must stop immediately upon:

- missing, expired, conflicting, or unverifiable authorization;
- role conflict or identity mismatch;
- provenance, completeness, integrity, custody, or sanitization failure;
- unexpected file, root, link, field, output, path, exception, dependency, network, Firestore, environment, or credential behavior;
- any financial, personal, bank, provider, identifier, or source-record content;
- any retry, fallback, mutation, persistence, disclosure, or deletion failure; or
- pressure to reinterpret a non-financial result as operational approval.

The operator must not investigate using the receipt or raw source data. Escalation must go to the implementation owner, security/privacy reviewers, operations governance, and final authorization owner using minimal non-sensitive metadata. Suspected sensitive-data exposure follows the existing security/privacy incident process and invalidates the receipt and authorization request.

Resumption requires root-cause review, disposal confirmation, corrected controls, a newly prepared receipt where applicable, repeated independent review, and fresh written authorization. No same-session exception is allowed.

## 16. Audit trail expectations

A future audit trail must be append-safe, access-controlled, and limited to non-sensitive control metadata. Candidate fields include:

- authorization-request reference;
- exact code and contract versions;
- role assignments and sign-off states;
- evidence-control version references;
- authorization decision, effective window, expiry, and revocation state;
- training and acknowledgement versions;
- high-level stop or incident reason code; and
- deletion-verification state.

The audit trail must not contain receipt content, output envelopes, input or storage paths, raw errors, landlord/lease/tenant/property/unit identifiers, source records, personal data, provider data, bank data, credentials, or financial values.

Phase 1C does not authorize persistence or define a storage implementation. Any audit-record implementation requires a separate schema, authorization, projection, retention, access, and append-safety review.

## 17. Conditions that keep operator use deferred

Operator use remains deferred if any of the following is true:

- no separately audited receipt producer exists for the proposed evidence class;
- any source-derived receipt relies on manual transcription or unbounded source access;
- a required role is unnamed, conflicted, unavailable, or unsigned;
- the request is not tied to exact versions, purpose, host, operator, and time window;
- the host, root, permission, integrity, custody, retention, deletion, or incident controls are not implemented and tested;
- package, CLI, execution, runtime, Firestore, environment, provider, payment, or financial behavior is introduced without separate authorization;
- output can be retained, leaked, reformatted, or overstated;
- tests, scans, training, acknowledgement, or final independent review are incomplete;
- the authorization is expired, revoked, amended after sign-off, or based on stale evidence; or
- any reviewer cannot distinguish receipt classification from environment or accounting readiness.

The default decision is no-go. Silence, urgency, prior approval, or partial evidence cannot convert a deferred state into authorization.

## 18. Future approval checklist

This checklist is evidence planning only and does not authorize use:

1. Confirm a bounded business purpose and non-financial interpretation.
2. Confirm exact code, adapter, wrapper, core, receipt, policy, and training versions.
3. Confirm all named roles and separation-of-duties requirements.
4. Confirm an independently audited receipt producer for the permitted evidence class.
5. Confirm provenance, completeness, consistency, redaction, and integrity evidence.
6. Confirm independent receipt approval and uninterrupted custody.
7. Confirm approved host, root, permission, file, and no-ambient-access controls.
8. Confirm bounded output, fixed failures, no-retention behavior, and deletion proof.
9. Confirm negative tests and scans for process, environment, Firestore, network, runtime, provider, payment, sensitive, and financial scope.
10. Confirm operator training and signed acknowledgement.
11. Confirm escalation, incident, revocation, and reauthorization procedures.
12. Confirm the minimal audit-trail design has separate approval if persistence is proposed.
13. Confirm all evidence is current and tied to the same immutable authorization request.
14. Complete a separate final go/no-go readiness audit.
15. Obtain explicit written authorization from the final authorization owner.

Until every item is satisfied and the final decision is affirmative, human use remains prohibited.

## 19. Non-goals

- No operator or developer use authorization.
- No execution procedure, command example, package script, CLI instruction, executable, local-command exposure, or runtime registration.
- No Firestore, emulator, environment, credential, cloud, network, provider, or payment access.
- No route, job, scheduler, server, worker, UI, or landlord-visible financial read.
- No source-provider implementation, migration, backfill, index, IAM, infrastructure, deployment, persistence, or audit-record implementation.
- No receipt input, output envelope, report, log, telemetry, screenshot, ticket, chat, email, or CI artifact retention.
- No financial output, balance, charge, payment, allocation, rent roll, aging result, schedule, or tenant balance.
- No payment mutation, Rotessa, PAD, bank data, settlement, custody, pooled funds, payout liability, or money movement.
- No production, operational, compliance, accounting-assurance, or certification claim.
- No change to existing ledger behavior or RC1 demo behavior.
- No treatment of tenant rent as RentChain revenue.

## 20. Recommended next PR, if any

The only safe next step is another docs-only evidence-planning artifact:

`docs/phase-1d-receivables-operator-authorization-evidence-checklist-v1`

Suggested document:

`docs/strategy/phase-1d-receivables-operator-authorization-evidence-checklist-v1.md`

Phase 1D should convert the control requirements into a versioned evidence checklist and decision matrix. It may define required evidence owners, freshness rules, pass/defer/reject states, conflict handling, expiry, and the structure of a future go/no-go review package.

Phase 1D must remain docs-only, pre-use, non-executable, and non-authorizing. It must not add commands, operator instructions, package or CLI registration, Firestore or environment access, runtime behavior, persistence, financial output, or readiness claims. It must not recommend an implementation PR until a later audit proves the controls rather than merely documenting them.

## 21. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Control plan is mistaken for authorization | Repeat the explicit non-authorization statement and require a separate final written decision |
| One person controls request, receipt, use, and approval | Enforce named roles and separation of duties |
| Receipt assertions are treated as datastore evidence | Require a separately audited producer, provenance, completeness, and independent approval |
| Sensitive or financial data enters the receipt | Exact allowlists, automated rejection, two-person review, and stop-on-doubt |
| File changes after approval | Integrity binding, single-session custody, and invalidation on modification |
| Host or root leaks data | Approve a narrow isolated context and prohibit synchronized, backed-up, or credentialed paths |
| Output becomes a readiness badge | Preserve the complete envelope and prohibit operational, accounting, and production conclusions |
| Local evidence persists | Maintain no-retention default and require disposal verification |
| Command exposure bypasses final review | Keep package, CLI, execution, and runtime registration deferred |
| Audit trail becomes a sensitive-data store | Limit it to non-sensitive control metadata and require separate persistence review |
| Payment architecture boundaries erode | Preserve direct settlement, landlord revenue, and no custody or money movement |

Phase 1C therefore establishes only a future authorization-control framework. Operator use remains unauthorized, and the Phase 1A adapter remains unregistered and test-invoked.
