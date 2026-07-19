# Phase 1D Receivables Operator Authorization Evidence Checklist v1

Status: evidence-planning checklist only; operator use remains unauthorized, and no execution procedure or runnable entrypoint is approved

## 1. Executive summary

Phase 1C defined the governance controls that would be required before any future human use of the Phase 1A test-only adapter could be considered. This Phase 1D checklist translates those controls into concrete evidence artifacts with accountable owners, independent reviewers, acceptance conditions, freshness rules, and fail-closed outcomes.

The checklist is not an authorization form and cannot produce authorization by itself. It does not approve an operator, host, receipt, command, or execution window. Missing, stale, conflicting, self-approved, or unverifiable evidence results in `defer` or `reject`, never implied approval.

This document contains no execution commands or operator procedure. It adds no package script, CLI instruction, runtime registration, Firestore or environment access, route, job, UI, persistence, or financial output. A later independent review would still have to evaluate an exact, immutable evidence package and issue an explicit written decision.

Tenant rent remains landlord or property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, provider execution, bank data, payment mutation, money movement, custody, pooled funds, landlord payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

The accounting foundation remains staged and backend-only: deterministic receivables projections, safe DTO assembly, legacy-source normalization, a disabled comparator, receipt-driven provider and readiness cores, the Phase 0U command core, the Phase 0W sanitized-file wrapper, and the Phase 1A injected dev-entrypoint adapter.

Phase 1A is unregistered and test-invoked. It is absent from package scripts, the accounting barrel, runtime startup, routes, jobs, schedulers, and UI. It consumes injected arguments, an injected approved root, an injected Phase 0W dependency, and injected output/error sinks. It does not read process arguments, environment values, Firestore, or global runtime configuration.

Phase 1B kept human use unauthorized. Phase 1C defined role separation, authorization-request, provenance, custody, output, retention, training, escalation, and audit-trail controls. None of those documents or library components establishes real-world evidence or operational readiness.

## 3. Purpose of the evidence checklist

This checklist provides a review structure for deciding whether the evidence needed for a future authorization review exists and is trustworthy enough to examine. Its purpose is to:

- identify each required artifact and its accountable owner;
- require an independent reviewer separate from the artifact producer;
- define objective acceptance, rejection, expiry, and conflict rules;
- bind all evidence to the same exact code and policy versions;
- keep sensitive, source, identifier, provider, and financial data out of the package;
- preserve non-financial interpretation boundaries; and
- prevent partial completion from becoming de facto operator approval.

The checklist evaluates evidence readiness only. It does not evaluate a live environment, run the adapter, or authorize use.

## 4. Explicit non-authorization statement

Operator and developer use outside the existing focused tests remains unauthorized.

Completion of any row, section, percentage, review, or sign-off in this checklist does not permit anyone to import, invoke, wrap, register, expose, or document use of the Phase 1A adapter or Phase 0W wrapper. A passing software test, repository permission, job title, prior approval, or synthetic receipt is not operator authority.

Only a future, separately approved go/no-go review tied to an exact commit, control package, operator, evidence class, host context, purpose, and time window could issue authorization. Phase 1D provides no such decision.

## 5. Required evidence package overview

Every future evidence package must use one immutable, non-sensitive package reference and include all artifact groups below:

| Evidence group | Minimum artifact | Default state if absent |
| --- | --- | --- |
| Authorization request | Version-bound request record | Reject |
| Roles and separation | Named owner/reviewer matrix and conflict check | Reject |
| Implementation boundary | Exact commit, contract versions, tests, and dependency scans | Defer |
| Receipt provenance | Approved producer, source-class, completeness, redaction, and integrity evidence | Reject source-derived use |
| Receipt approval | Independent sanitization and content-class approval | Reject |
| Host/root/file handling | Approved-context, custody, permission, integrity, and disposal evidence | Defer |
| Output handling | Exact projection, fixed-failure, non-retention, and interpretation evidence | Defer |
| Retention/deletion | Policy, verification method, and failure response | Reject |
| Training/acknowledgement | Version-specific completion and signed boundaries | Defer |
| Escalation/incident | Stop, notification, containment, revocation, and resumption plan | Defer |
| Audit trail | Separately approved minimal metadata design or explicit no-persistence decision | Defer |
| Final sign-off | Independent consolidated review and explicit written disposition | Reject |

Artifact references must point only to approved non-sensitive control evidence. Receipt bodies, output envelopes, raw paths, source records, credentials, personal data, provider data, bank data, and financial values must not be embedded or attached.

## 6. Evidence owners and reviewers

Each artifact must have one accountable owner and at least one qualified independent reviewer:

| Artifact domain | Accountable owner | Required independent reviewer |
| --- | --- | --- |
| Purpose and request | Request sponsor | Operations governance |
| Accounting boundaries | Accounting architecture owner | Product/release authority |
| Code and test boundary | Implementation owner | Security reviewer |
| Privacy and redaction | Privacy owner | Security reviewer |
| Receipt provenance | Receipt-producer owner | Accounting architecture and privacy reviewers |
| Receipt sanitization | Receipt preparer | Receipt approver |
| Host, root, and custody | Operations owner | Security reviewer |
| Output interpretation | Accounting architecture owner | Operations governance |
| Retention and deletion | Privacy owner | Security and operations reviewers |
| Training | Operations governance | Accounting architecture owner |
| Incident response | Security owner | Privacy and operations reviewers |
| Final disposition | Final authorization owner | All required domain reviewers |

The request sponsor, receipt preparer, receipt approver, proposed operator, and final authorization owner must not collapse into one person. Reviewers must disclose conflicts. Self-review, delegated rubber-stamping, unsigned acceptance, or unavailable ownership keeps the package deferred or rejected.

## 7. Authorization request evidence

Required artifacts:

- a unique non-sensitive package/request reference unrelated to any landlord, lease, tenant, unit, property, payment, provider, or datastore identifier;
- a bounded business purpose and one explicitly non-financial review question;
- exact repository commit and adapter, wrapper, command-core, receipt-contract, policy, checklist, and training versions;
- the proposed evidence classification, operator identity, role, host class, root policy, and authorization window;
- all role assignments, conflict declarations, expiry, revocation, and reauthorization terms;
- explicit prohibited conclusions and non-retention expectations;
- a scope statement excluding Firestore, environment, provider, payment, PAD, bank data, money movement, financial output, routes, jobs, UI, and runtime behavior; and
- immutable final-review state with a record of any superseded request.

Acceptance requires exact version alignment, complete roles, bounded purpose, no sensitive content, and no unresolved conflict. Any material edit after review invalidates prior sign-offs.

## 8. Receipt provenance evidence

Synthetic fixtures remain the only currently approved input class. Evidence for any future source-derived receipt must include:

- a separately reviewed deterministic producer design and exact producer version;
- the approved source class, authority model, and bounded evidence window;
- ownership, exact-scope, complete-query, pagination, consistency, and no-catch-to-empty evidence;
- a field-level allowlist and redaction proof applied before receipt construction;
- evidence that identifiers, raw records, paths, credentials, environment values, personal information, provider payloads, bank data, and financial amounts cannot enter the receipt;
- preparer and independent provenance-review sign-offs;
- an integrity binding created after approval without exposing receipt content; and
- documented one-way custody with no manual enrichment, repair, or reinterpretation.

Manual transcription, copied logs, screenshots, raw documents, database/provider exports, and ad hoc scripts are rejection conditions. Phase 1A test results cannot substitute for source provenance.

## 9. Sanitized receipt approval evidence

Required evidence must show that the candidate receipt:

- uses the exact supported manifest and receipt versions;
- includes the complete required category set and only exact allowlisted keys;
- contains readiness assertions and aggregates only, never record-level content;
- contains no identifiers, paths, secrets, environment values, personal information, provider/bank data, financial values, or internal source references;
- contains no balances, charges, payments, allocations, rent roll, aging, schedules, or tenant balances;
- passed shape, type, size, unsafe-content, and regular-file gates under the reviewed contract;
- was independently approved after preparation;
- retained the same integrity binding through custody; and
- was invalidated on any modification, version mismatch, transfer anomaly, or failed check.

The approval artifact may retain only minimal non-sensitive control metadata. It must not contain the receipt body. Rejected evidence cannot be edited in place or replaced without a new preparation and approval cycle.

## 10. Approved-root and file-handling evidence

No host or root is approved by this checklist. A future package must provide evidence for:

- a reviewed local host class with no required production, preview, staging, emulator, cloud, or ambient credential access;
- a policy-defined ephemeral session root outside repositories, broad home paths, downloads, shared, synchronized, indexed, or backed-up locations;
- one explicit relative JSON file and no discovery, glob, fallback, stdin, inline, URL, archive, or alternate input;
- traversal, symlink, non-regular-file, size, extension, permission, and containment rejection tests;
- least-privilege access limited to the approved custody roles and time window;
- integrity verification at approval, custody transfer, and the final pre-review gate;
- proof that no output or report file is created; and
- a disposal-verification method covering the session root and incidental local copies.

Evidence must be version-bound and must not disclose the actual local path. Unproven backup, sync, indexing, permission, custody, or disposal behavior keeps use deferred.

## 11. Output handling evidence

The package must demonstrate that only the complete bounded Phase 0U non-financial envelope or a fixed non-sensitive failure code can be produced. Required artifacts include:

- exact output-schema and maximum-size evidence;
- tests proving paths, arguments, host/operator data, receipt content, source metadata, raw errors, identifiers, personal/provider/bank data, and financial values are excluded;
- tests for output-sink and unexpected-error failure paths;
- a reviewed interpretation statement preserving status, warnings, reason codes, next steps, timestamp semantics, and summary limitations together;
- controls preventing transformation into a pass badge, score, report, accounting conclusion, or operational approval;
- evidence that output is not redirected, piped, copied, screenshotted, uploaded, logged, telemetered, or retained; and
- a minimal permitted human decision statement that does not reproduce the envelope.

`ready_for_next_audit` remains a receipt-assertion classification only. Any evidence suggesting broader conclusions is a rejection condition.

## 12. Retention and deletion evidence

Default posture is no retention of receipt inputs or adapter outputs beyond one bounded review session. Required evidence must address:

- temporary files and directories;
- editors, recent-file lists, shell history, terminal capture, clipboard managers, crash reports, and endpoint telemetry;
- indexing, synchronized storage, backups, screenshots, tickets, chat, email, and CI artifacts;
- who verifies deletion, the deadline, the verification method, and the escalation path when proof is unavailable;
- automatic invalidation or revocation when retention boundaries fail; and
- the separately approved minimal metadata fields, if any, that may survive the session.

Any proposed persistence requires a separate design for purpose, classification, access, encryption, location, duration, legal hold, deletion proof, incident response, and audit access. Receipt bodies, output envelopes, source evidence, paths, sensitive data, and financial data remain prohibited from retention.

## 13. Training and acknowledgement evidence

Required artifacts include:

- versioned training material containing no execution commands;
- completion evidence for the exact proposed operator and current control versions;
- a signed acknowledgement that technical access is not authorization;
- acknowledgement of receipt-assertion, non-financial, next-audit-only interpretation;
- acknowledgement of no alternate input, ad hoc repair, retry, fallback, test modification, or temporary call site;
- acknowledgement of no Firestore, environment, credential, provider, payment, bank-data, money-movement, output-retention, or disclosure behavior;
- recognition of every stop condition and the required escalation route;
- direct-settlement and landlord-revenue boundary acknowledgement; and
- expiry and retraining rules for changes to code, controls, roles, evidence class, or interpretation.

Training completion cannot authorize use. Missing, expired, generic, or version-mismatched training keeps the package deferred.

## 14. Escalation and incident-handling evidence

The package must include a reviewed plan showing:

- fixed stop conditions for authorization, role, provenance, integrity, custody, sanitization, file, output, dependency, retention, and interpretation failures;
- named security, privacy, implementation, operations, accounting, and final-authorization escalation contacts by role, not sensitive contact detail;
- minimal non-sensitive incident reason codes;
- immediate invalidation of the receipt and candidate authorization upon suspected exposure or scope breach;
- prohibition on investigating with raw source data or continuing in the same session;
- containment and disposal-verification responsibilities;
- criteria for root-cause review, control correction, new receipt preparation, repeated independent review, and fresh authorization; and
- evidence that no urgency or business exception can bypass the stop state.

An untested, ownerless, or ambiguous escalation plan is insufficient. Incident evidence must not contain receipt content, paths, identifiers, raw errors, or financial data.

## 15. Audit trail evidence

Phase 1D does not approve persistence. A future package must provide either an explicit reviewed no-persistence decision or a separately authorized minimal audit-trail design.

Permitted candidate metadata is limited to:

- non-sensitive request/package reference;
- exact code, contract, control, training, and checklist versions;
- role assignments and sign-off states;
- evidence-reference states without embedded evidence content;
- final disposition, effective window, expiry, revocation, and supersession state;
- high-level stop or incident reason code; and
- deletion-verification state.

The design must prove append-safe history, access control, audience projection, retention, deletion, and correction-by-supersession. It must exclude receipts, outputs, paths, identifiers, records, personal/provider/bank data, credentials, and financial values. Any implementation requires a separate authorized mission.

## 16. Sign-off package contents

A package submitted for future review must contain, in a stable order:

1. Package index and immutable non-sensitive reference.
2. Authorization request and bounded-purpose statement.
3. Exact code and control version manifest.
4. Role matrix, conflict declarations, and reviewer independence attestations.
5. Implementation-boundary tests and protected-scope scans.
6. Receipt-provenance and producer evidence, or explicit synthetic-only classification.
7. Sanitized-receipt approval and integrity/custody evidence.
8. Host/root/file-handling and disposal-control evidence.
9. Output-boundary and interpretation evidence.
10. Retention/deletion policy and verification evidence.
11. Training and acknowledgement evidence.
12. Escalation/incident and revocation evidence.
13. Audit-trail no-persistence decision or separately approved design reference.
14. Open risks, exceptions, conflicts, expiry dates, and superseded artifacts.
15. Individual domain-review dispositions.
16. Final independent go/no-go review placeholder, initially set to `defer`.

The package must contain references and conclusions, not raw source or sensitive artifacts. It must fail closed if artifacts disagree or cannot be inspected safely.

## 17. Conditions that keep operator use deferred

Operator use remains deferred when any artifact is:

- absent, incomplete, unsigned, self-approved, conflicted, or unverifiable;
- tied to a different code, receipt, policy, host, role, training, or checklist version;
- expired, revoked, superseded, amended after sign-off, or outside its evidence window;
- dependent on manual transcription, unbounded source access, catch-to-empty behavior, capped-query ambiguity, or alias-only ownership;
- stored with receipt content, output, paths, identifiers, personal/provider/bank data, credentials, or financial values;
- unable to prove host, root, integrity, custody, retention, deletion, output, or incident controls;
- dependent on package, CLI, runtime, Firestore, environment, route, job, UI, provider, payment, or money-movement behavior not separately authorized; or
- interpreted as operational, production, accounting, schema, financial, or payment readiness.

The disposition hierarchy is `reject` for prohibited or unsafe evidence, `defer` for missing or unresolved evidence, and reviewable only when every artifact is accepted and mutually consistent. Reviewable does not mean authorized.

## 18. Non-goals

- No operator or developer use authorization.
- No execution procedure, command, package script, CLI instruction, executable, local-command exposure, or runtime registration.
- No Firestore, emulator, environment, credential, cloud, network, provider, or payment access.
- No route, job, scheduler, server, worker, UI, or landlord-visible financial read.
- No source-provider, receipt-producer, migration, backfill, index, IAM, infrastructure, deployment, persistence, or audit-record implementation.
- No receipt body, output envelope, report, log, telemetry, screenshot, ticket, chat, email, or CI artifact retention.
- No financial output, balance, charge, payment, allocation, rent roll, aging, schedule, or tenant balance.
- No payment mutation, Rotessa, PAD, bank data, settlement, custody, pooled funds, payout liability, or money movement.
- No production, operational, compliance, accounting-assurance, or certification claim.
- No change to existing ledger or RC1 demo behavior.
- No treatment of tenant rent as RentChain revenue.

## 19. Recommended next PR, if any

The only safe next step is a docs-only evidence-review decision matrix:

`docs/phase-1e-receivables-operator-authorization-evidence-review-matrix-v1`

Suggested document:

`docs/strategy/phase-1e-receivables-operator-authorization-evidence-review-matrix-v1.md`

Phase 1E may define artifact-level `accept`, `defer`, and `reject` criteria, freshness and conflict rules, package-level aggregation, reviewer independence checks, and the structure of a future final review record. Its initial and default package disposition must remain `defer`.

Phase 1E must remain docs-only, pre-use, non-executable, and non-authorizing. It must not add execution commands, operator instructions, package or CLI registration, Firestore or environment access, runtime behavior, persistence, financial output, or production/operational-readiness claims. It must not recommend implementation until a later audit proves the controls exist outside documentation.

## 20. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Checklist completion is mistaken for authorization | State that only a later explicit final decision can authorize an exact workflow |
| Evidence package contains sensitive material | Permit only non-sensitive control references and reject embedded source, path, or financial content |
| Owners approve their own evidence | Require independent named reviewers and conflict declarations |
| Stale artifacts are mixed with current code | Bind every artifact to exact versions and expiry/freshness rules |
| Receipt shape is treated as provenance | Require a separately audited producer, authority, completeness, redaction, and integrity evidence |
| File custody cannot be reconstructed | Require approval-to-disposal integrity and custody evidence |
| Output becomes a pass badge | Preserve full limitations and prohibit operational, accounting, and production conclusions |
| Deletion is assumed rather than proven | Require a verifier, deadline, method, and escalation on failure |
| Incident response exposes more data | Limit records to fixed non-sensitive reason codes and prohibit raw investigation artifacts |
| Documentation quietly enables execution | Keep package, CLI, runtime, Firestore, environment, route, job, and UI paths deferred |
| Accounting work drifts into payment execution | Preserve direct settlement, landlord revenue, and no custody or money movement |

Phase 1D therefore defines only the evidence needed for a future review. Operator use remains unauthorized, and the Phase 1A adapter remains unregistered and test-invoked.
