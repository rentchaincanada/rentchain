# Phase 0Z Receivables Local Inventory Entrypoint Readiness v1

Status: entrypoint-readiness audit only; no entrypoint, execution command, or operator authorization is added or approved by this phase

## 1. Executive summary

Phase 0W provides a safe local-file consumption function for one explicitly supplied sanitized receipt manifest. Phase 0Y documents the controls required before human use but explicitly withholds operator authorization. The remaining question is whether an entrypoint contract can be implemented without turning the wrapper into an executable operational tool.

A package script, process-bound local command, or operator-facing developer utility is not yet safe. Those options would create discoverable execution paths before an approved workstation, receipt producer and provenance chain, operator authorization process, retention controls, and final end-to-end entrypoint evidence exist.

A narrowly scoped Phase 1A implementation may proceed only as an unregistered, dependency-injected dev-entrypoint adapter invoked by focused tests. It may parse an injected argument array, call Phase 0W, map results to fixed exit/status categories, and write only to injected output sinks. It must not read process arguments, environment variables, stdin, or configuration; register a package script; print through global console streams; access Firestore or a network; or have a runtime call site. It is an entrypoint-contract test surface, not a human-operable command.

Operator use remains unauthorized. Execution-command documentation remains deferred. Tenant rent remains landlord/property-manager revenue, not RentChain revenue, and the future payment posture remains direct settlement through an external processor rather than RentChain custody.

## 2. Current accounting foundation recap

The staged accounting foundation includes deterministic receivables projections, safe DTO assembly, legacy-source normalization, non-financial comparison and diagnostic cores, receipt-driven source/readiness classifiers, and the Phase 0U schema-inventory command core.

Phase 0W adds bounded local receipt-file handling:

- one caller-supplied approved root and relative JSON path;
- traversal, symlink, non-regular file, and size rejection;
- strict receipt-only field validation and prohibited-content rejection;
- no file write, directory discovery, fallback, environment, network, or Firestore access; and
- the unchanged Phase 0U envelope capped at `ready_for_next_audit`.

Phase 0X concluded that these function guarantees do not establish operator readiness. Phase 0Y converted the adoption controls into a pre-use runbook without commands or authorization. No supported execution entrypoint exists today.

## 3. What Phase 0W provides

Phase 0W provides a typed library boundary that receives `approvedRoot` and `inputFilePath` as explicit data. It validates the root and file, reads one bounded file, parses and sanitizes the receipt object, invokes Phase 0U, and returns a non-financial result or a fixed local error code.

Its tests cover valid, missing, malformed, unsafe, unsupported, linked, directory, and oversized inputs, Phase 0U receipt-validation failures, output safety, and forbidden dependencies. The complete accounting suite and production TypeScript build passed when Phase 0W was introduced.

Phase 0W does not:

- parse a process command line;
- define help, version, exit, stdout, or stderr behavior;
- fix or govern an approved root;
- create or validate provenance records;
- authorize an operator or workstation;
- register any package or runtime invocation; or
- prove that supplied receipt assertions came from complete or authoritative evidence.

## 4. What Phase 0Y permits and does not permit

Phase 0Y permits reviewers to use a shared pre-use vocabulary for:

- role separation;
- receipt provenance and sanitization requirements;
- narrow approved-root and file-handling expectations;
- output interpretation and prohibited conclusions;
- no-retention and deletion expectations;
- stop conditions; and
- future implementation and sign-off gates.

Phase 0Y does not permit operator or developer execution outside tests. It supplies no command, executable, package script, CLI procedure, environment setup, Firestore access, source producer, runtime call site, or production guidance.

The runbook cannot authorize itself. Its checklist becomes relevant only after a separately implemented and audited entrypoint exists.

## 5. Why entrypoint readiness needs separate review

An entrypoint changes the threat and governance surface even when the underlying function is unchanged. It introduces questions that Phase 0W intentionally avoided:

- where arguments originate and how unknown, duplicate, or missing values fail;
- who controls the approved root;
- whether process globals or ambient configuration influence behavior;
- how success, non-ready, invalid input, and unexpected failure map to status codes;
- what appears on standard output and standard error;
- whether paths, arguments, raw exceptions, or receipt data leak;
- how the entrypoint becomes discoverable through package metadata or documentation;
- where it can be invoked from and who may invoke it;
- whether output is redirected, logged, retained, or mistaken for evidence; and
- whether a dev utility quietly becomes a production or support tool.

These are adoption controls, not details that can be inferred from a safe library function.

## 6. Entrypoint options

| Option | Readiness decision | Reason |
| --- | --- | --- |
| No entrypoint; remain test-only | Safe baseline | Preserves the current governed boundary but does not validate argument and output mapping |
| Package script | Deferred | Makes execution discoverable and easy before operator, root, provenance, and retention controls are approved |
| Local process command | Deferred | Requires process arguments, global streams, stable exit behavior, packaging, and host controls not yet proven |
| Existing Phase 0W test harness | Retain | Continues to prove wrapper behavior with synthetic fixtures but is not an operator interface |
| New test-only dev-entrypoint adapter | Narrowly approve for Phase 1A | Can prove parsing and output contracts through injected dependencies without creating a runnable command |
| Operator-facing dev utility | Deferred | Would imply human use and needs final authorization, workstation, provenance, retention, and documentation controls |

The Phase 1A adapter must remain less capable than a real command: unregistered, unmounted, test-invoked, and unable to inspect ambient process or environment state.

## 7. Recommended entrypoint posture

Approve only a backend-only Phase 1A dev-entrypoint adapter with these properties:

- accepts an injected immutable argument list rather than reading process arguments;
- accepts injected bounded output and error sinks rather than using global console streams;
- accepts an injected approved-root policy or fixed test root rather than discovering a directory;
- accepts exactly one explicit relative receipt-file argument under that root;
- calls the existing Phase 0W wrapper without bypassing or duplicating its file and receipt checks;
- maps success, non-ready, invalid invocation, invalid file, and internal failure to fixed non-financial status categories;
- serializes only the Phase 0U envelope on the success/non-ready path;
- emits only fixed error codes on the failure path;
- remains absent from package scripts, startup code, runtime call sites, routes, jobs, schedulers, UI, and documentation commands; and
- is invoked only from focused tests with synthetic temporary files.

This posture tests an eventual interface contract. It does not create a supported human command and does not authorize an operator run.

## 8. Approved local execution context, if any

No human execution context is approved in Phase 0Z.

The only approved Phase 1A context would be automated focused tests that:

- run locally or in ordinary test CI without cloud credentials or environment-derived behavior;
- use synthetic temporary receipt files only;
- inject arguments, approved root, and output sinks directly;
- do not start or connect to an emulator, application server, worker, or network service;
- do not persist input, output, or diagnostics as artifacts; and
- make no schema, environment, adapter, deployment, or operational-readiness claim.

A developer workstation, controlled admin host, preview environment, or production environment remains outside the approved context even if it can technically import the adapter.

## 9. Receipt provenance requirements

Phase 1A tests may use only repository-owned synthetic fixtures or temporary derivatives created entirely inside the test. Those fixtures prove software behavior only.

Before any later human use, a separate audited receipt-producing process must provide:

- a supported producer and receipt-contract version;
- a documented synthetic or source-derived classification;
- preparer and independent reviewer attribution outside the receipt body;
- evidence that raw documents, exports, logs, screenshots, and provider payloads were excluded;
- confirmation that the file was unchanged after review; and
- a reviewable chain that does not expose identifiers or sensitive fields.

No source-derived receipt is approved for Phase 1A. Manual transcription from production, tenant, lease, property, payment, or provider data remains prohibited.

## 10. Sanitized receipt-file requirements

Every Phase 1A test input must remain within the Phase 0W receipt contract:

- supported manifest and receipt versions;
- the ten defined receipt categories only;
- exact allowlisted keys only;
- readiness assertions and receipt-state aggregates only;
- one relative JSON file beneath the injected test root;
- regular, non-linked, bounded file content; and
- no extension objects, raw records, identifiers, paths, credentials, environment values, personal data, bank/provider data, or financial data.

The adapter must not weaken, duplicate, catch-and-ignore, or translate away a Phase 0W rejection. It must not fall back to another file, default fixture, stdin, inline content, URL, glob, or directory scan.

## 11. Retention/deletion controls

Phase 1A tests must create any temporary root and receipt inside the test lifecycle and remove them after each test. No input or result may be uploaded, snapshotted as an external artifact, written to a report file, or logged through global streams.

The adapter itself must not write, append, cache, queue, transmit, or persist any data. Injected sinks used in tests must remain in memory and be asserted for exact bounded content.

Human-use retention remains governed by the Phase 0Y no-retention default. A later request to preserve output requires a separate policy and is not part of entrypoint implementation.

## 12. Non-financial output boundaries

The success or non-ready output may contain only the existing Phase 0U fields:

- `ok`;
- `inventoryStatus` capped at `ready_for_next_audit`;
- `commandCoreVersion` and `phase`;
- bounded `reasonCodes`, `warnings`, and `requiredNextSteps`;
- normalized `checkedAt`; and
- aggregate `receiptSummary`.

The entrypoint adapter must not add input path, approved root, arguments, host, operator, environment, project, receipt body, receipt category details, identifiers, records, financial fields, or raw errors.

Failure output must be a fixed non-sensitive code. Unexpected exceptions must map to one generic internal-failure code without message, stack, path, or value leakage.

No status may imply production, operational, adapter, deployment, schema, index, IAM, accounting, or payment readiness.

## 13. Operator authorization/sign-off requirements

Phase 1A requires implementation review but no operator role because human execution remains prohibited. Merge approval for Phase 1A would mean only that the injected adapter contract is safe in tests.

Before later operator use, separate sign-off remains required from:

- implementation owners for the exact executable interface and version;
- security/privacy reviewers for path, input, output, exception, and dependency boundaries;
- operations reviewers for workstation, approved root, identity, roles, stop conditions, and deletion controls;
- accounting governance reviewers for interpretation and landlord-revenue boundaries; and
- an explicit final readiness audit that authorizes the exact workflow.

No package owner, developer, test result, or merged runbook may substitute for final operator authorization.

## 14. Execution-command documentation policy

Execution-command documentation remains deferred.

Phase 0Z and Phase 1A must not add:

- command examples or runnable snippets;
- package-script names or invocation instructions;
- process-command syntax;
- environment setup or credential guidance;
- Firestore, emulator, preview, staging, production, or admin execution steps; or
- language suggesting that a developer or operator may try the adapter manually.

Phase 1A documentation may describe types, injected contracts, status mappings, and test boundaries only. A later audit must explicitly approve any human-facing command documentation after a real entrypoint and operator context are independently validated.

## 15. Test requirements before implementation

Phase 1A must add focused backend tests for:

- missing, duplicate, unknown, and malformed injected arguments;
- exactly one explicit relative JSON input;
- injected approved-root enforcement;
- Phase 0W traversal, symlink, non-regular, missing, unreadable, oversized, malformed, unsupported, and unsafe failures;
- Phase 0U ready, non-ready, partial, ambiguous, contradictory, and blocked outcomes;
- deterministic mapping to fixed status categories;
- exact in-memory success and error sink content;
- no path, argument, receipt, exception, environment, identity, provider, bank, or financial leakage;
- no input mutation, output file, fallback, retry, directory discovery, network, subprocess, or global logging;
- no process argument, environment, stdin, console, Firestore/Firebase/cloud SDK, runtime, route, job, scheduler, UI, provider, or payment dependency;
- call-site scans showing only focused tests use the adapter; and
- the complete accounting suite and backend production TypeScript build.

Manual product QA is not required while the adapter remains unregistered, test-invoked, and non-user-visible.

## 16. Non-goals

- No entrypoint implementation in Phase 0Z.
- No package script, executable command, CLI instruction, or documented invocation.
- No operator or developer execution authorization.
- No process arguments, environment, stdin, global console, configuration, credential, project, network, or cloud access.
- No Firestore/emulator adapter, read, write, or index probe.
- No runtime registration, route, job, scheduler, server, worker, or UI.
- No source-derived receipt producer, migration, backfill, infrastructure, index, IAM, or deployment change.
- No persistent input, output, report, event, telemetry, screenshot, or artifact.
- No financial output or landlord-visible financial read.
- No payment mutation, provider integration, Rotessa, PAD, bank data, settlement, custody, or money movement.
- No production, operational, compliance, accounting-assurance, or certification claim.
- No change to existing ledger or RC1 demo behavior.
- No treatment of tenant rent as RentChain revenue.
- No RentChain-held funds, pooled rent accounts, trust custody, landlord payout liabilities, or settlement float.

## 17. Recommended next PR, if safe

Approve the narrowly bounded implementation branch:

`backend/phase-1a-receivables-local-inventory-dev-entrypoint-v1`

Phase 1A should add only an unregistered, backend-only, dependency-injected dev-entrypoint adapter and focused tests. It must remain test-invoked and must not use process globals, add a package script, create a runnable command, add documentation instructions, or authorize human use.

Phase 1A may call Phase 0W and expose deterministic argument, status, and injected-output contracts for tests. It must not change Phase 0U or Phase 0W readiness ceilings or file/receipt validation behavior.

After Phase 1A, conduct another docs-only adoption audit. Do not infer operator use, package registration, or execution documentation from successful implementation tests.

## 18. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Test adapter is mistaken for a supported command | Keep it unregistered, test-invoked, and undocumented as an execution path |
| Package script makes execution discoverable | Defer all package metadata changes |
| Process globals introduce ambient behavior | Inject arguments, root policy, and sinks; prohibit process and environment access |
| Adapter weakens Phase 0W validation | Call Phase 0W directly and preserve every rejection unchanged |
| Synthetic success becomes environment evidence | Label results as software-contract tests only |
| Output leaks paths or raw errors | Allow only the Phase 0U envelope or fixed generic failure codes |
| Temporary inputs persist | Use test-scoped roots and deterministic cleanup; add no output files |
| Human use bypasses sign-off | Keep operator use explicitly unauthorized pending a later audit |
| Entrypoint grows into route, job, or runtime utility | Enforce call-site and protected-scope scans |
| Accounting work drifts into payment behavior | Preserve direct settlement and exclude provider, PAD, custody, and money movement |

Phase 0Z therefore approves only a test-invoked Phase 1A dev-entrypoint adapter contract. It does not approve a package script, local process command, operator-facing utility, execution documentation, or human use.
