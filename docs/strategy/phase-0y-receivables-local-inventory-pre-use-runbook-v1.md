# Phase 0Y Receivables Local Inventory Pre-Use Runbook v1

Status: pre-use guidance only; operator or developer use of the Phase 0W wrapper outside tests is not authorized

## 1. Purpose and authority boundary

This runbook records the controls that must exist before any future human use of the Phase 0W local schema-inventory wrapper can be considered. It is a review and readiness artifact, not an execution procedure.

This document does not:

- authorize an operator or developer to invoke the wrapper;
- provide an executable entrypoint, package script, command, or CLI procedure;
- approve Firestore, emulator, environment, credential, runtime, route, job, scheduler, or UI access;
- approve source-derived receipts, production evidence, or persistent output; or
- establish production, operational, schema, index, IAM, accounting, or payment readiness.

Phase 0W remains a backend library function and test harness. Any use outside its existing tests requires a separately approved entrypoint, implementation review, and operator-readiness decision.

## 2. Current capability boundary

Phase 0W accepts a caller-supplied approved root and one explicit relative JSON receipt-file path. Within that function boundary, it:

- resolves and validates the approved root;
- rejects absolute paths, traversal, symlinks, and non-regular files;
- enforces a 64 KiB file-size limit;
- reads one file without directory discovery or fallback;
- rejects malformed JSON, unsupported fields, and prohibited content;
- invokes the Phase 0U command core only after validation; and
- returns the unchanged Phase 0U non-financial envelope, capped at `ready_for_next_audit`.

It does not create receipts, prove receipt provenance, select an approved workstation, authorize an operator, expose a supported executable interface, or govern output retention. Passing its checks means only that a supplied receipt object satisfied the implemented local-file and receipt-classification rules.

## 3. Pre-use decision

Operator use is currently blocked. No person may treat this runbook as permission to invoke Phase 0W outside tests.

A future use decision requires all of the following to be approved separately:

1. a supported and reviewed entrypoint;
2. an exact implementation version;
3. a controlled local execution context;
4. a receipt provenance and independent-review process;
5. an approved-root policy enforced by the entrypoint;
6. bounded output and failure behavior;
7. a no-retention or separately governed retention policy;
8. focused tests against the final entrypoint; and
9. named review and sign-off roles.

Until every gate is satisfied, the only approved use remains automated testing with synthetic fixtures.

## 4. Roles and separation of duties

Any future operator workflow must define at least these roles:

- **Receipt preparer:** produces or receives the sanitized receipt manifest under an approved process.
- **Receipt reviewer:** independently checks provenance, allowed fields, prohibited content, and manifest completeness.
- **Run approver:** confirms that the exact entrypoint, workstation class, file-handling plan, and review record are approved.
- **Operator:** performs only the separately approved workflow and does not prepare or approve the same receipt.
- **Result reviewer:** interprets the complete envelope within the next-audit-only boundary.

One person must not silently combine preparation, approval, operation, and result interpretation. For synthetic developer validation, roles may be simplified only by a later explicit approval; the result still cannot become environment or operational evidence.

No role in this runbook grants production, admin, support, payment, provider, infrastructure, IAM, or Firestore authority.

## 5. Approved-context prerequisites

Before a future run can be considered, reviewers must verify that the proposed context is:

- local-only and disconnected from application runtime;
- limited to synthetic or separately approved sanitized receipts;
- independent of production, preview, staging, emulator, and cloud services;
- free of required environment configuration, cloud identity, application-default credentials, service-account keys, and provider credentials;
- outside CI, deployment, server, worker, route, job, scheduler, and admin/support processes;
- limited to a reviewed workstation class with local file protections; and
- based on a supported entrypoint rather than an improvised script, REPL import, test modification, or application call site.

The presence of ambient credentials on a workstation is a risk even when Phase 0W does not inspect them. A future approval must address that host condition rather than assuming the wrapper neutralizes it.

## 6. Receipt provenance requirements

Every future receipt must have a reviewable provenance record outside the receipt body. That record must identify:

- the approved receipt-producing process and its version;
- whether the receipt is synthetic;
- the preparation and review roles;
- the preparation and review times;
- the receipt contract version;
- the source class, without copying source identifiers or sensitive data;
- confirmation that no raw document, export, log, screenshot, or provider payload was used as the receipt file; and
- confirmation that the receipt was not changed after review.

No receipt producer is approved today. Manual transcription from production or tenant data is prohibited because it does not prove completeness, creates privacy risk, and can introduce unsupported assertions.

An accepted JSON shape is not provenance. The Phase 0W prohibited-term check is defense in depth, not an authorization, data-loss-prevention, or truth-verification mechanism.

## 7. Sanitized receipt-file requirements

A candidate receipt file must:

- use the supported Phase 0U manifest and receipt versions;
- contain only the ten defined receipt categories and their exact allowlisted fields;
- contain readiness assertions and aggregate receipt-state evidence only;
- remain below the Phase 0W size ceiling;
- contain no raw records, samples, free-form notes, attachments, encoded payloads, or nested extension objects;
- contain no internal or external identifiers;
- contain no Firestore, document, collection, storage, or filesystem paths;
- contain no credentials, secrets, tokens, keys, environment values, or project configuration;
- contain no personal, tenant, landlord, property, lease, provider, or bank data; and
- contain no balances, amounts, charges, payments, allocations, rent roll, aging, receivable schedules, or tenant balances.

If a reviewer cannot prove that every field belongs to the exact receipt contract, the file is rejected. Removing an unsafe field after rejection does not make the same artifact trustworthy without repeating the complete provenance and review process.

## 8. Approved-root and file-handling expectations

Any future approved workflow must use a newly created, narrow, session-specific local input root. The root must not be:

- the repository root;
- a user home or system root;
- a downloads or desktop directory;
- shared, synchronized, automatically backed up, indexed, or watched by another process; or
- reused for unrelated files or later sessions.

The input must be one explicitly selected relative JSON file beneath that root. It must be a regular file and must not be a symlink, directory, device, pipe, socket, archive, URL, inline value, or multiple-file set.

The future entrypoint must enforce the approved-root rule. An operator-selected broad root is not acceptable merely because the underlying function accepts a root parameter.

The reviewed file must remain unchanged between approval and evaluation. Unexpected changes, additional files, permission changes, or link behavior require the workflow to stop.

## 9. Output contract and interpretation

The only permitted result is the Phase 0U non-financial envelope:

- `ok` reports whether the supplied receipt assertions passed next-audit classification;
- `inventoryStatus` is capped at `ready_for_next_audit`;
- `reasonCodes` identify missing, unsafe, ambiguous, contradictory, or incomplete receipt assertions;
- `warnings` preserve the next-audit-only limitation;
- `checkedAt` repeats the normalized receipt timestamp and does not prove a source read;
- `requiredNextSteps` identifies review categories, not executable remediation; and
- `receiptSummary` counts receipt states, not datastore records or financial objects.

The complete envelope and its warning must be considered together. A single field, screenshot, paraphrase, or empty reason list must not be presented without the provenance and authority limitations.

Fixed local error codes indicate only an invocation, file, JSON, shape, or unsafe-content rejection. They do not prove that source data is absent, complete, safe, or not applicable.

## 10. Permitted conclusions

After a future separately authorized run, an operator may conclude only that:

- the explicitly supplied file passed the implemented Phase 0W file and receipt gates at the time of evaluation;
- the resulting receipt object was evaluated by the Phase 0U core;
- the returned reason codes and receipt summary correspond to the supplied assertions; and
- a `ready_for_next_audit` result allows human review of a later audit question.

For a synthetic fixture, reviewers may conclude that the reviewed wrapper and entrypoint behaved according to their tested packaging contract. They may not extrapolate that conclusion to any live datastore, environment, identity, or accounting state.

## 11. Prohibited conclusions

No result may be used to claim that:

- operator use is generally authorized;
- Firestore, an emulator, or any deployed environment was inspected;
- receipt evidence is authoritative, complete, current, or source-derived;
- schema, indexes, IAM, ownership, query exhaustion, consistency, redaction, rollout, rollback, or an adapter is operationally ready;
- a route, diagnostic job, UI, landlord financial read, migration, or deployment may proceed;
- financial records, balances, rent roll, aging, payments, allocations, or reconciliation are correct;
- a compliance, accounting, security, or audit certification has been produced;
- production or RC1 behavior has been validated; or
- payment processing, PAD, provider execution, settlement, or money movement is enabled.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Nothing in this runbook models RentChain-held funds, pooled rent accounts, trust custody, landlord payout liabilities, or settlement float.

## 12. Logging, retention, and deletion expectations

The default future policy is no persistence beyond the controlled local review session.

- Do not store the receipt or result in the repository, a shared drive, cloud synchronization, automatic backup, issue, PR, chat, email, ticket, analytics system, telemetry service, or CI artifact.
- Do not redirect, pipe, upload, screenshot, or attach the result.
- Do not log the input root, file path, receipt body, raw error, stack, host identity, arguments, project configuration, or environment state.
- Do not retain terminal capture or shell history containing receipt material or results.
- Record only the human decision that another audit is required; do not record the envelope as operational evidence.
- Remove the session-specific receipt and root after the approved review window using the workstation's approved recoverable handling process.

If retention is later required, use must remain blocked until a separate policy approves classification, access, encryption, location, duration, deletion, legal hold, audit access, and incident response.

## 13. Pre-use review checklist

Every item must be confirmed before a later run can be authorized:

- [ ] A separately reviewed entrypoint and exact version exist.
- [ ] A later implementation-readiness audit authorizes this entrypoint.
- [ ] The workstation class and local-only context are approved.
- [ ] No Firestore, emulator, cloud, environment, credential, provider, or runtime dependency is required.
- [ ] The receipt-producing process and provenance record are approved.
- [ ] The receipt is synthetic or comes from a separately audited sanitizer.
- [ ] The preparer and independent reviewer completed their checks.
- [ ] The receipt contains only supported allowlisted fields.
- [ ] The receipt contains no identifiers, paths, personal data, financial data, bank data, credentials, or provider data.
- [ ] A narrow session-specific approved root and one relative regular JSON file are planned.
- [ ] The root is not shared, synchronized, backed up, indexed, or tracked.
- [ ] Output interpretation and no-retention expectations are understood.
- [ ] Stop conditions and escalation ownership are understood.
- [ ] The run approver records an explicit decision outside the receipt and result.

This checklist cannot authorize use by itself. If any item is false, unknown, ambiguous, or not applicable without evidence, the decision is stop.

## 14. Stop conditions and response

Stop the readiness process when:

- no supported entrypoint or exact version is available;
- a person proposes an improvised invocation method;
- receipt provenance is missing, self-approved, ambiguous, or source-derived without an audited producer;
- the receipt contains or may contain prohibited data;
- the input root is broad, shared, synchronized, backed up, indexed, reused, or outside the approved context;
- any file, permission, or review state changes after approval;
- cloud, emulator, environment, credential, network, runtime, route, job, scheduler, or UI access appears necessary;
- output would be persisted, redirected, uploaded, logged, or treated as evidence;
- a status is interpreted beyond next-audit discussion; or
- any unexpected dependency, output field, file mutation, error, or behavior occurs.

After a stop, do not retry with a broader root, different file, removed field, fallback, or improvised tool. Record only that the readiness gate failed and route the issue to a new audit or implementation review.

## 15. Review and sign-off gates

Future operator use requires separate sign-off for:

1. **Implementation:** the entrypoint is narrow, local-only, non-mutating, and tested.
2. **Security/privacy:** the receipt and output contracts exclude sensitive and financial data.
3. **Operations:** the workstation, approved root, roles, stop conditions, and no-retention handling are enforceable.
4. **Accounting governance:** conclusions remain receipt-classification-only and preserve the landlord-revenue boundary.
5. **Final readiness:** a new audit explicitly authorizes the exact entrypoint and workflow version.

Approval of this document satisfies none of those future execution gates. It only establishes the content that reviewers should evaluate.

## 16. Non-goals

- No operator or developer execution authorization.
- No execution command, package script, CLI procedure, or runnable example.
- No runtime registration, route, job, scheduler, server, worker, or UI.
- No Firestore or emulator access, source adapter, read, write, or index probe.
- No environment, credential, project, metadata, network, cloud, or provider access.
- No receipt producer, migration, backfill, infrastructure, index, IAM, or deployment change.
- No persistent output, report, event, telemetry, screenshot, or artifact.
- No financial output or landlord-visible financial read.
- No payment mutation, Rotessa, PAD, bank data, settlement, custody, or money movement.
- No production, operational, compliance, accounting-assurance, or certification claim.
- No change to existing ledger or RC1 demo behavior.

## 17. Next readiness decision

The next step, if separately approved, should be another docs-only audit:

`audit/phase-0z-receivables-local-inventory-entrypoint-readiness-v1`

That audit should determine whether any test-only local entrypoint contract is justified and whether it can enforce the approved-root, argument, output, failure, call-site, and no-retention boundaries. It must not assume that this runbook authorizes implementation or use.

Until a later audit and implementation are approved and validated, Phase 0W remains test-bound for governed use. This Phase 0Y runbook is pre-use guidance only.
