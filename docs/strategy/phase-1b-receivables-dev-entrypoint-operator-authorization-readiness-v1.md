# Phase 1B Receivables Dev Entrypoint Operator Authorization Readiness v1

Status: readiness audit only; Phase 1A remains unregistered and test-invoked, and human or operator use is not authorized

## 1. Executive summary

Phase 1A proves that an injected adapter can map one explicit sanitized receipt-file argument into the Phase 0W local wrapper and emit only a bounded, non-financial Phase 0U result or a fixed error code. It remains absent from package scripts, the accounting barrel, runtime startup, routes, jobs, schedulers, and user interfaces. It does not read process arguments, environment values, Firestore, or global configuration.

Those properties make Phase 1A safe as a test-only contract. They do not make it safe for a human operator. There is still no approved operator role, supported execution context, authoritative receipt producer, provenance chain, fixed approved-root policy, enforceable retention control, or final interpretation sign-off. Registering a command or documenting an invocation now would convert a test seam into an unsupported operating path.

Decision: operator authorization remains deferred. Package scripts, CLI commands, local-command registration, and execution instructions remain prohibited. The next safe PR is a docs-only Phase 1C operator-authorization control plan. Phase 1C may define ownership, evidence, approval, custody, retention, and final authorization gates, but it must not authorize a run or add an executable path.

Tenant rent remains landlord or property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, provider execution, bank data, payment mutation, money movement, custody, pooled rent accounts, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

The staged accounting foundation now includes deterministic receivables projections, landlord-safe DTO assembly, legacy-source normalization, a disabled non-financial comparator, receipt-driven provider and readiness cores, the Phase 0U schema-inventory command core, the Phase 0W sanitized-file wrapper, and the Phase 1A injected dev-entrypoint adapter.

Every layer remains deliberately separated from a public financial read and from payment execution. Phase 1A adds interface-contract coverage only. Its focused tests and the full accounting suite establish deterministic behavior for synthetic inputs; they do not establish the truth, currency, completeness, or authority of real-world evidence.

No Firestore adapter, production source provider, operator command, route, job, scheduler, UI, or runtime invocation exists as a result of Phase 1A.

## 3. What Phase 1A provides

Phase 1A provides:

- an immutable injected argument list with exactly one supported input flag and value;
- an injected approved root rather than a discovered directory;
- an injected call to Phase 0W rather than direct file or source access;
- injected output and error sinks rather than process-global streams;
- fixed non-financial result statuses and bounded exit-code data;
- strict projection of the Phase 0U envelope before serialization;
- fixed input-rejected and internal-failure codes without raw exception disclosure;
- output size and unsafe-term gates;
- focused tests using synthetic, test-scoped files; and
- no package, barrel, startup, runtime, Firestore, environment, route, job, scheduler, or UI registration.

These guarantees reduce accidental coupling and output leakage. They prove the adapter contract under injected test conditions only.

## 4. What Phase 1A does not authorize

Phase 1A does not authorize:

- a developer, support user, administrator, or other operator to invoke the adapter manually;
- creation or publication of a package script, CLI command, local utility, run instruction, or executable wrapper;
- use of production, preview, staging, emulator, CI, or controlled-admin evidence;
- access to Firestore, cloud metadata, environment configuration, credentials, provider systems, or financial records;
- preparation of receipts from real source data;
- persistence, upload, redirection, or operational use of input or output;
- a claim that schema, indexes, IAM, completeness, consistency, redaction, an adapter, or deployment is ready; or
- landlord-visible financial reads, accounting assurance, payment execution, or operational readiness.

Technical importability is not authorization. A developer must not add an ad hoc call site, modify a test to process real evidence, or invoke the adapter through a REPL or temporary script.

## 5. Operator-use risk assessment

| Risk | Current condition | Readiness decision |
| --- | --- | --- |
| Human identity and authority cannot be proven | No operator role or approval record exists | Block human use |
| Receipt assertions may be mistaken for authoritative evidence | No approved producer or provenance chain exists | Block source-derived inputs |
| Caller can choose an unsafe host or root | Root is injected but no operating policy is enforced | Block operator execution |
| A documented command becomes de facto support tooling | No lifecycle or ownership model exists | Keep commands undocumented |
| Non-financial status is overstated | `ready_for_next_audit` may be misquoted | Require reviewed interpretation controls |
| Input or output persists in local tooling | No enforceable retention mechanism exists | Require no-retention design and sign-off |
| Ambient credentials create false confidence | Adapter does not inspect globals, but host state is ungoverned | Prohibit connected contexts |
| Test seam accumulates runtime consumers | No registration exists today | Preserve call-site and package scans |

Overall assessment: no Phase 1A implementation defect requires correction, but the governance and operating controls needed for human use are not present.

## 6. Required controls before human/operator use

Before any human use can be considered, all of the following must exist and be reviewed together:

1. A named business owner and technical owner for the exact workflow version.
2. A narrowly defined operator role with least privilege and separation from receipt preparation and approval.
3. A supported, version-pinned entrypoint whose behavior exactly matches the reviewed adapter contract.
4. A separately audited receipt producer with authoritative provenance and no manual transcription from raw financial or tenant data.
5. A fixed or centrally governed local approved-root policy and an approved isolated host context.
6. A two-person preparation and review control before the receipt reaches the operator.
7. Bounded output rendering that preserves warnings and cannot expose input, paths, exceptions, or financial fields.
8. Enforceable retention and deletion controls for inputs, outputs, temporary storage, backups, terminal capture, and incident evidence.
9. Stop and escalation procedures for any validation failure, unexpected output, dependency access, or provenance gap.
10. A final readiness audit that reviews the exact implementation, documentation, test evidence, roles, and operating context and explicitly authorizes or rejects use.

Documentation alone cannot satisfy these controls.

## 7. Authorization and sign-off model

Any future authorization must be explicit, version-specific, revocable, and limited to the approved purpose. It must require sign-off from:

- the accounting architecture owner, confirming interpretation and landlord-revenue boundaries;
- the implementation owner, confirming the exact entrypoint, dependency, and output contracts;
- security and privacy reviewers, confirming source, host, path, sensitive-data, logging, and deletion boundaries;
- operations governance, confirming operator identity, training, segregation of duties, stop conditions, and incident handling; and
- the designated product or release authority, issuing the final written authorization for the exact workflow.

The receipt preparer must not be the sole reviewer or the operator who interprets the result. Authorization must identify the permitted evidence class, host context, repository version, expiration or review date, and revocation procedure. A merged PR, passing test, runbook, role title, or repository access must never be treated as operator authorization.

Phase 1B grants none of these approvals.

## 8. Receipt provenance requirements

A future receipt must be produced by a separately reviewed, deterministic process that records outside the receipt body:

- producer and receipt-contract versions;
- source class and permitted environment classification;
- preparation timestamp and bounded evidence window;
- completeness, pagination, consistency, and redaction assertions;
- preparer and independent reviewer identities through an approved audit mechanism;
- content-integrity binding after review; and
- explicit confirmation that raw documents, identifiers, paths, provider payloads, personal information, bank data, credentials, and financial amounts were excluded.

The Phase 1A adapter must not create, fetch, infer, enrich, or repair provenance. Synthetic fixtures remain the only approved Phase 1A inputs. Manual transcription, screenshots, copied logs, database exports, and direct production documents are prohibited substitutes for a governed producer.

## 9. Sanitized receipt-file handling requirements

Any later approved workflow must preserve every Phase 0W gate and additionally require:

- one reviewed JSON receipt file using the exact supported manifest version and allowlisted fields;
- one narrow, session-specific root chosen by policy, not freely improvised by the operator;
- a local regular file with no symlink, traversal, alternate stream, archive, shared-drive, synchronized-folder, or backup path;
- permissions limited to the approved preparer, reviewer, and operator roles for the shortest necessary interval;
- no filename, directory, file metadata, or receipt content containing source identifiers or sensitive labels;
- integrity verification between approval and use without placing sensitive metadata in the receipt;
- no fallback file, auto-discovery, stdin, inline input, URL, glob, directory scan, or retry with alternate evidence; and
- deterministic deletion after the review window under an approved disposal process.

An unexpected path, field, source classification, file mutation, or wrapper rejection must stop the workflow. It must not be corrected ad hoc during a run.

## 10. Retention and deletion requirements

The default posture remains no persistence beyond one controlled review session. A future policy must cover both the input and every representation of the output, including temporary files, editor history, shell or terminal capture, logs, clipboard managers, backups, telemetry, screenshots, tickets, chat, and CI artifacts.

Until a policy is approved:

- inputs and outputs must not be committed, uploaded, redirected, piped, copied into tickets, or retained as evidence;
- the adapter must not write reports, caches, audit events, telemetry, or result files;
- the operator must not preserve raw or formatted output;
- only a separately approved, minimal human decision record may be considered in a later control design; and
- any inability to verify deletion must block use rather than create an exception.

If retention is later required, the design must define classification, lawful purpose, minimal fields, encryption, access, region, duration, deletion proof, legal hold, incident response, and audit access before authorization.

## 11. Output handling and interpretation limits

The only permitted adapter success or non-ready output remains the bounded Phase 0U envelope. Failures remain fixed non-sensitive codes. No future operator layer may add receipt content, paths, arguments, host data, identity data, source records, raw exceptions, financial values, or provider information.

All interpretations must preserve the complete status, warnings, reason codes, required next steps, and receipt summary. Output must not be reformatted into a pass badge, production approval, accounting conclusion, or operational certificate.

`ready_for_next_audit` means only that the supplied assertions met the command core's bounded next-audit rules. It does not prove that those assertions are true or that any environment, schema, index, IAM policy, query, source adapter, financial balance, or payment workflow is ready.

## 12. Execution-command documentation policy

Execution-command documentation remains prohibited. Phase 1B and the recommended Phase 1C must not contain runnable syntax, copy-paste snippets, process invocation examples, package-script names, shell aliases, REPL guidance, test modifications, environment setup, credential setup, or Firestore/emulator connection steps.

Future execution documentation may be considered only after the exact entrypoint, host policy, operator authorization, receipt producer, retention policy, tests, and final readiness decision are approved together. Documentation must then be version-bound and reviewed as part of the authorization package; it cannot precede authorization or create it implicitly.

## 13. Package script / CLI / local command policy

Package scripts, CLI registration, executable files, process-bound commands, and operator-facing local utilities remain deferred.

The Phase 1A adapter must stay:

- absent from package metadata and executable bins;
- absent from the accounting barrel and runtime startup;
- without process-argument, process-environment, global-console, stdin, or runtime-configuration access;
- without production or support call sites; and
- invoked only by focused tests using injected dependencies and synthetic data.

Any proposal to register a command is a separate implementation mission requiring a new risk review. It must not be treated as a mechanical wrapper around Phase 1A.

## 14. Firestore and environment-access policy

Firestore and environment access remain fully deferred. Neither Phase 1A nor a future documentation-only control plan may:

- import or initialize Firestore, Firebase, cloud, provider, or payment clients;
- read production, preview, staging, emulator, or local datastore content;
- read environment variables, application-default credentials, service-account material, cloud metadata, project configuration, or global runtime state;
- query, backfill, migrate, index, write, reconcile, or mutate source data; or
- infer readiness from ambient credentials or connectivity.

If a source-producing adapter is later proposed, it requires its own implementation authorization, least-privilege identity, complete-query evidence, redaction design, emulator tests, rollout plan, and readiness audit. That future work must remain separate from operator-command authorization.

## 15. Required tests/checks before any future operator use

Before a final authorization decision, evidence must include:

- focused tests for all Phase 1A argument, root, wrapper rejection, core status, output, sink-failure, and unexpected-error paths;
- invariant tests proving fixed bounded output and no paths, arguments, receipt bodies, raw errors, personal data, provider data, bank data, or financial data;
- dependency and static scans proving no process, environment, stdin, console, Firestore/Firebase/cloud, network, subprocess, provider, payment, route, job, scheduler, UI, or runtime dependency;
- call-site and package scans proving the adapter remains limited to the exact approved consumer and tests;
- tests for the future entrypoint's identity, role, version, approved-root, provenance, integrity, retention, and stop-condition controls;
- end-to-end exercises using synthetic receipts only until a source producer is separately authorized;
- documentation review against the exact commit and operating-control versions;
- negative exercises showing missing approval, expired authorization, custody breaks, provenance gaps, and deletion failures block use; and
- a final independent readiness review after all evidence exists.

Passing Phase 1A's 21 focused tests, the 251-test accounting suite, and the backend build is necessary foundation evidence, not operator authorization.

## 16. Non-goals

- No operator or developer execution authorization.
- No operator instructions, execution commands, package scripts, CLI, executable, runtime registration, route, job, scheduler, or UI.
- No Firestore, emulator, environment, credential, cloud, network, provider, or payment access.
- No source producer, adapter, migration, backfill, index, IAM, infrastructure, deployment, or persistence change.
- No input or output retention, operational log, audit event, report, telemetry, screenshot, or artifact.
- No financial output or landlord-visible financial read.
- No balances, charges, payments, allocations, rent roll, aging, receivable schedules, or tenant balances.
- No payment mutation, Rotessa, PAD, bank data, settlement, custody, pooled funds, payout liability, or money movement.
- No production, operational, compliance, accounting-assurance, or certification claim.
- No change to existing ledger behavior or RC1 demo behavior.
- No treatment of tenant rent as RentChain revenue.

## 17. Recommended next PR, if safe

Approve only the docs-only prerequisite:

`docs/phase-1c-receivables-operator-authorization-control-plan-v1`

Suggested document:

`docs/strategy/phase-1c-receivables-operator-authorization-control-plan-v1.md`

Phase 1C should translate this audit into a control ownership and evidence plan covering role definitions, separation of duties, sign-off records, receipt provenance, approved host and root policy, integrity custody, output handling, retention and deletion, authorization expiry, revocation, incident handling, and the evidence package required for a future go/no-go audit.

Phase 1C must remain docs-only. It must not contain execution commands, package scripts, CLI guidance, Firestore or environment access, operator instructions, runtime registration, financial output, or language authorizing use. After Phase 1C, conduct another explicit readiness audit; do not infer a command implementation or human authorization from the control plan.

## 18. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Importable adapter is mistaken for approved tooling | State that technical accessibility is not authorization and keep all runtime registration absent |
| A runbook or control plan becomes implicit approval | Require a separate final, version-specific written authorization |
| Receipt shape is confused with source truth | Require an audited producer, independent review, integrity binding, and completeness evidence |
| Operator selects an unsafe host or root | Require an approved isolated context and policy-bound session root before use |
| Output is quoted as readiness evidence | Preserve full warnings and cap conclusions at receipt classification for the next audit |
| Inputs or outputs survive the session | Maintain no-retention default and require deletion verification before authorization |
| Package or CLI registration bypasses governance | Treat registration as a separate mission with a fresh risk review |
| Ambient cloud access widens scope | Prohibit process, environment, credential, Firestore, network, and runtime dependencies |
| Financial or payment scope enters through diagnostics | Enforce non-financial projections and preserve direct settlement and landlord revenue |
| Test success is presented as operational assurance | Separate software-contract evidence from provenance, host, operator, and environment evidence |

Phase 1B therefore keeps Phase 1A unregistered, test-invoked, and unauthorized for human use. The only safe next step is a docs-only operator-authorization control plan.
