# Phase 0X Receivables Local Inventory Operator Readiness v1

Status: operator-readiness audit only; Phase 0W remains a local function and test harness, and operator execution outside tests is not yet authorized

## 1. Executive summary

Phase 0W safely consumes one explicitly identified, sanitized JSON receipt file inside a caller-supplied approved root. It rejects absolute paths, traversal, symlinks, non-regular files, oversized files, malformed JSON, unsupported receipt fields, and prohibited content. Only after those checks does it invoke the Phase 0U command core and return the existing non-financial envelope capped at `ready_for_next_audit`.

Those guarantees are necessary but not sufficient for human operator use. Phase 0W has no executable package script, argument parser, approved workstation definition, receipt-preparation workflow, receipt provenance proof, operator authorization, stdout/stderr contract, retention control, or supported invocation path outside tests. Calling the exported function through an improvised script, REPL, application import, or test modification would bypass the staged adoption boundary.

Decision: operator or developer use outside the existing focused tests remains deferred. The next safe PR may be a docs-only Phase 0Y operator runbook that records preparation, handling, interpretation, and disposal controls. Phase 0Y must be explicitly pre-operational: it may not include executable commands, production instructions, Firestore or environment access, or language that authorizes an operator run. A later audit must review the runbook and any proposed entrypoint before operator execution can be approved.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, provider execution, bank data, money movement, custody, pooled funds, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

The accounting sequence now includes:

- deterministic receivables, balance, aging, and rent-roll primitives;
- landlord-safe DTO assembly and legacy-source normalization;
- a disabled non-financial shadow comparator and injected diagnostic runner core;
- receipt-driven source-provider and schema-readiness classifiers;
- the Phase 0U schema-inventory command core; and
- the Phase 0W local sanitized-file wrapper.

These components remain staged foundations. They do not mount a landlord financial route, run a diagnostic job, connect to Firestore, or execute payments. The Phase 0W wrapper is exported from the accounting library but has no package script, CLI registration, runtime call site, route, job, scheduler, or UI.

Phase 0W validation covered 24 focused wrapper cases and the full accounting suite. Its production build passed. That evidence proves the implemented file and output boundary for synthetic test inputs; it does not prove an operator workflow or the truth of a receipt manifest.

## 3. What Phase 0W provides

Phase 0W provides:

- an explicit `approvedRoot` and relative `inputFilePath` contract;
- `.json` extension enforcement;
- canonical-root and containment checks;
- rejection of absolute paths and traversal;
- rejection of symlinks and non-regular files;
- a 64 KiB maximum enforced before and after opening the file;
- no-follow file opening and a single bounded read;
- strict top-level and per-receipt field allowlists;
- prohibited-term checks for paths, credentials, environment values, bank/provider data, and financial fields;
- fixed, non-sensitive local error codes;
- invocation of Phase 0U only after wrapper validation; and
- the unchanged Phase 0U result envelope with a maximum status of `ready_for_next_audit`.

It has no file write, directory listing, fallback input, network call, Firestore client, environment lookup, subprocess, route, job, scheduler, UI, provider integration, or payment behavior.

## 4. What Phase 0W does not prove

Phase 0W does not prove:

- that any receipt was generated from authoritative or complete source evidence;
- who prepared, reviewed, approved, or transferred a receipt file;
- that a receipt statement is truthful merely because its shape is accepted;
- that an operator workstation is approved, isolated, or free of ambient credentials;
- that the approved root has correct ownership, permissions, retention, or backup behavior;
- that a source artifact was sanitized before reaching the wrapper;
- that local shell history, terminal capture, redirection, or monitoring is safe;
- a stable executable interface, argument contract, exit-code contract, or stdout/stderr boundary;
- that a developer can invoke the function without adding unreviewed code;
- schema, index, IAM, query, completeness, consistency, deployment, adapter, or operational readiness; or
- production, preview, emulator, CI, admin, support, or landlord-facing safety.

The unsafe-term filter is a defense-in-depth gate, not a data-loss-prevention system or provenance verifier. `ready_for_next_audit` classifies the supplied receipt assertions only.

## 5. Operator-use risk assessment

| Risk | Current state | Decision |
| --- | --- | --- |
| Ad hoc invocation changes code or bypasses validation | No supported entrypoint exists | Block operator use |
| Receipt provenance is unknown | No producer or approval chain exists | Block real-evidence use |
| Raw source data is mistaken for sanitized receipts | No preparation workflow exists | Block source-derived input |
| Developer workstation has ambient cloud credentials | Wrapper does not inspect them, but host controls are unproven | Block controlled/admin use |
| Output is treated as operational approval | Status name can be overstated without training | Require explicit interpretation rules |
| Output or input is retained in shell history, logs, or backups | No retention controls exist | Require no-retention default |
| Approved root is chosen too broadly | Root is caller supplied | Require a narrow ephemeral root before use |
| File changes between preparation and execution | No manifest signing or provenance binding exists | Require single-session custody and later review |
| Wrapper is connected to Firestore or runtime | Explicitly out of scope | Prohibit |

Overall classification: not ready for operator execution outside tests. No P0 runtime defect is identified in the Phase 0W function; the blockers are adoption, provenance, entrypoint, and operating-control gaps.

## 6. Approved local execution context

No operator execution context is approved in Phase 0X. The following describes the minimum candidate context that a later audit would need to approve:

- a developer-controlled local workstation used only for synthetic or independently sanitized receipts;
- no production, preview, staging, emulator, or cloud connection required for the run;
- no use of application-default credentials, service-account keys, `.env` files, project configuration, or cloud metadata;
- a newly created, narrow, session-specific input root outside synchronized, shared, indexed, or automatically backed-up folders;
- a single explicitly selected receipt file under that root;
- no application server, worker, route, scheduler, or deployment process running the wrapper;
- no CI or admin/support environment; and
- an approved, reviewed entrypoint rather than an improvised TypeScript file, REPL call, or test edit.

Until the entrypoint and host controls are separately approved, even this candidate context remains descriptive, not executable authorization.

## 7. Sanitized receipt-file preparation requirements

A future operator workflow must accept only a receipt manifest that:

1. contains the ten Phase 0U receipt categories and supported manifest version;
2. contains assertions and aggregate readiness evidence only;
3. was created without copying raw Firestore documents, provider payloads, exports, logs, or screenshots;
4. contains no IDs, document/collection/storage paths, credentials, secrets, environment values, bank data, provider data, personal data, or financial values;
5. contains no balances, charges, payments, allocations, rent roll, aging, receivable schedules, or tenant balances;
6. contains only the exact allowlisted keys accepted by Phase 0W;
7. is reviewed independently from the wrapper by a designated preparer and reviewer;
8. records its provenance and approval outside the receipt body only through a future approved process;
9. is synthetic unless a separately audited source-to-receipt producer exists; and
10. is never presented as evidence that a real datastore or environment was inspected.

Phase 0X does not approve a receipt producer. Manual transcription from production data is not an acceptable substitute because it creates unbounded privacy, completeness, and accuracy risk.

## 8. Approved-root and file-handling requirements

A future runbook must require:

- a new, narrowly scoped input directory created for one session;
- no use of the repository root, home directory, downloads directory, shared drive, cloud-sync folder, or system root as `approvedRoot`;
- one relative `.json` file path beneath that root;
- a regular file, not a symlink, hard-link workflow, directory, device, pipe, socket, or archive;
- file size at or below the wrapper's 64 KiB limit;
- local permissions limited to the preparing operator where the host supports them;
- no directory scanning, globbing, default filename, fallback, URL, stdin, inline JSON, or multiple-file invocation;
- no modification of the receipt after review and before the run;
- no wrapper-generated output file; and
- deletion of the input root after the approved review window, subject to the no-retention policy below.

The caller-supplied root remains a material adoption risk. A future entrypoint must either fix the approved root to a reviewed location or validate it under an equally strict contract.

## 9. Output interpretation rules

The Phase 0W return value is the Phase 0U envelope:

- `ok` means the supplied receipt assertions passed the core's next-audit checks;
- `inventoryStatus` never exceeds `ready_for_next_audit`;
- `reasonCodes` identify failed or ambiguous receipt assertions;
- `warnings` retain the next-audit-only boundary;
- `requiredNextSteps` describe evidence categories needing review;
- `checkedAt` is the receipt timestamp, not proof of a source read; and
- `receiptSummary` counts receipt states, not records, money, leases, tenants, properties, or datastore coverage.

The operator must preserve the full envelope when discussing a result. `ok`, `inventoryStatus`, or an empty reason list must not be quoted without the warning and source/provenance limitations.

Local wrapper errors describe invocation or file rejection only. They must not be converted into evidence that data is absent, safe, complete, or not applicable.

## 10. What an operator may conclude

From a future approved run, an operator may conclude only that:

- the explicitly supplied file passed Phase 0W path, file, size, JSON, field, and prohibited-content checks at the time it was read;
- the parsed receipt assertions were evaluated by the Phase 0U core;
- the returned reason codes and receipt-state counts correspond to that supplied manifest; and
- `ready_for_next_audit`, if returned, permits human discussion of the next audit gate only.

For synthetic fixtures, the operator may also conclude that the local packaging boundary behaves consistently with the tested contract. This is a software-behavior conclusion, not an environment-readiness conclusion.

## 11. What an operator must not conclude

An operator must not conclude or represent that:

- Firestore, an emulator, production, preview, or staging was inspected;
- the receipt was authoritative, complete, current, independently verified, or source-derived;
- schema, indexes, IAM, ownership, pagination, consistency, redaction, rollout, or rollback is operationally ready;
- a Firestore adapter, diagnostic job, route, UI, or landlord financial read may proceed;
- a successful result approves deployment, migration, production access, or financial reporting;
- absence of prohibited terms proves absence of sensitive data in the source process;
- the wrapper is a security scanner, compliance attestation, audit certificate, or accounting assurance tool;
- landlord or tenant balances are correct;
- payments, PAD, provider execution, settlement, reconciliation, or money movement is enabled; or
- tenant rent is RentChain revenue or RentChain holds, pools, custodies, or pays out rent funds.

## 12. Logging and retention policy

Default policy: do not persist Phase 0W input or output beyond the controlled local review session.

- Do not redirect output to a file, pipe it to another process, upload it, attach it to a PR/ticket/chat, or store it as a CI artifact.
- Do not log the approved root, input path, receipt body, raw error, stack, workstation identity, project configuration, or environment state.
- Do not place the input under version control, shared storage, cloud synchronization, automatic backup, indexing, or telemetry collection.
- Do not capture terminal sessions or screenshots containing the envelope unless a later retention design explicitly approves them.
- Record only the human decision that further audit is required; do not record the receipt or envelope as operational evidence.
- Remove the session-specific input root after review using the host's approved recoverable handling process.

If evidence retention becomes necessary, Phase 0X requires a separate design covering classification, redaction, access, encryption, retention duration, deletion, audit access, and incident handling. A runbook cannot create that authority by documentation alone.

## 13. Manual checklist for future operator-run workflow

This checklist is a readiness gate, not current execution authorization:

1. Confirm a separately approved entrypoint and exact version exist.
2. Confirm the workstation and local-only context were approved for this purpose.
3. Confirm the receipt is synthetic or produced by a separately audited sanitizer.
4. Confirm preparer and reviewer completed the receipt-only allowlist review.
5. Confirm no Firestore, environment, credential, provider, bank, personal, or financial data is present.
6. Confirm a narrow session-specific root and one relative regular `.json` file are used.
7. Confirm the file is not linked, shared, synchronized, backed up, or tracked by Git.
8. Confirm no cloud/emulator connection, application process, or runtime registration is involved.
9. Invoke only through the separately approved entrypoint; do not improvise a call site.
10. Verify the result contains only the Phase 0U envelope or a fixed Phase 0W error code.
11. Interpret all statuses as receipt classification for the next audit only.
12. Do not persist, redirect, upload, screenshot, or quote the result as operational evidence.
13. Remove the temporary input after the review window.
14. Stop and report any unexpected field, output, error, file mutation, or dependency access.

Any unchecked item blocks the future run.

## 14. Required tests/checks before operator use

Before operator use can be approved, a future implementation and audit must verify:

- a reviewed entrypoint with one explicit input and no defaults or discovery;
- exact CLI or invocation parsing, help text, fixed exit codes, and bounded stdout/stderr;
- no raw exception, path, argument, receipt, host, or environment leakage;
- no package lifecycle, server startup, runtime, route, job, scheduler, or CI registration;
- approved-root policy that cannot be widened casually by the operator;
- traversal, symlink, non-regular file, oversize, unreadable, malformed, unsafe, partial, ambiguous, and contradictory cases;
- no output or mutation files and no retry/fallback behavior;
- no Firestore/Firebase/cloud SDK, environment, network, subprocess, provider, or payment dependency;
- call-site scanning proving the wrapper is invoked only by the approved entrypoint and tests;
- operator documentation review against the exact implementation version;
- end-to-end testing with synthetic files only; and
- a new readiness decision after tests pass.

The existing 24 focused tests and 230-test accounting suite remain strong foundation evidence, but they do not satisfy the entrypoint and operator-control items.

## 15. Non-goals

- No operator execution authorization in Phase 0X.
- No package script, executable registration, runtime call site, route, job, scheduler, or UI.
- No Firestore/emulator read or write and no Firestore adapter.
- No environment, credential, project, metadata, network, or cloud access.
- No receipt producer, migration, backfill, index, IAM, infrastructure, or deployment change.
- No persistent log, report, audit event, telemetry, screenshot, or CI artifact.
- No landlord-visible financial read or existing ledger behavior change.
- No payment mutation, provider integration, Rotessa, PAD, bank data, or money movement.
- No balances, charges, payments, allocations, rent roll, aging, receivable schedules, or tenant balances.
- No production, operational, compliance, accounting-assurance, or certification claim.
- No treatment of tenant rent as RentChain revenue.
- No RentChain-held funds, pooled rent accounts, trust custody, landlord payout liabilities, or settlement float.
- No RC1 demo behavior change.

## 16. Recommended next PR, if safe

Approve a docs-only prerequisite:

`docs/phase-0y-receivables-local-inventory-operator-runbook-v1`

Suggested document:

`docs/strategy/phase-0y-receivables-local-inventory-operator-runbook-v1.md`

Phase 0Y should convert the requirements in this audit into a concise pre-use runbook covering role expectations, sanitized-receipt preparation review, narrow-root handling, interpretation, stop conditions, no-retention policy, and the manual gate checklist.

Phase 0Y must not include copy-paste execution commands, package scripts, code, production/emulator/Firestore instructions, environment configuration, credential setup, runtime invocation, routes, jobs, UI, financial output, or operational-readiness claims. Its status must say that operator execution remains deferred until an entrypoint and its controls pass a later implementation-readiness audit.

The docs-only runbook is safe because it reduces interpretation and handling risk without enabling execution. It does not approve operator use. After Phase 0Y, audit whether a test-only invocation adapter or executable contract is justified; do not infer that implementation from this document.

## 17. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Exported function is treated as an operator command | State that no supported entrypoint exists and prohibit improvised call sites |
| Sanitized input is assumed authoritative | Require separate provenance and preparation review; default to synthetic only |
| Caller selects a broad approved root | Require a narrow session-specific root and later entrypoint enforcement |
| Ambient credentials create perceived production access | Require a no-cloud local context and prohibit environment discovery |
| `ready_for_next_audit` is overstated | Define exact permitted conclusions and require the warning with every discussion |
| Output is retained as evidence | Default to no persistence, redirection, upload, screenshot, or artifact |
| Runbook becomes execution authorization | Exclude commands and mark operator use deferred |
| Manual sanitizer leaks raw data | Do not approve manual production transcription; require a separately audited producer |
| Wrapper becomes a route, job, or runtime import | Require call-site scans and a separate implementation audit |
| Accounting work drifts into payment execution | Preserve direct settlement and exclude provider, PAD, custody, and money movement |

Phase 0X therefore approves only a docs-only Phase 0Y pre-use runbook. Phase 0W remains test-bound for governed use, and no human operator execution outside tests is authorized yet.
