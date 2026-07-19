# Phase 0V Receivables Schema Inventory Adoption Readiness v1

Status: adoption-readiness audit only; no executable, Firestore access, CLI entrypoint, environment access, route, job, or runtime change is authorized in this phase

## 1. Executive summary

Phase 0U is safe as a pure receipt classifier, but it does not make a Firestore-connected schema-inventory executable safe. It proves deterministic validation, bounded non-financial output, and a maximum status of `ready_for_next_audit` for injected receipts. It does not prove receipt provenance, filesystem safety, operator identity, environment binding, Firestore permissions, deployed indexes, or persisted-data completeness.

A narrowly constrained Phase 0W implementation may proceed: `backend/phase-0w-receivables-schema-inventory-local-command-v1`. It may add a local-only wrapper that accepts one explicit path to an already-sanitized JSON receipt manifest, parses it under strict size/type rules, invokes Phase 0U, and prints only the Phase 0U envelope to standard output. Tests may use synthetic files and emulator-produced sanitized artifacts.

Phase 0W must not connect to the emulator or Firestore, import Firebase/Google Cloud clients, inspect ambient environment variables, discover projects or credentials, write files, run in ordinary CI with credentials, or execute in a controlled admin/dev environment. Those adoption steps require later audits. A local wrapper validates packaging and operator ergonomics; it does not collect real evidence or establish schema, index, IAM, adapter, deployment, or runtime readiness.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, payment processing, bank data, money movement, custody, pooled funds, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

Phases 0 through 0T define pure accounting projections, safe DTO and normalization boundaries, receipt-driven diagnostic components, exact-query and rollout plans, schema-readiness classification, and the inventory-command adoption contract.

Phase 0U adds ten injected receipt classes for schema, indexes, IAM, completeness, consistency, pagination, unsafe-field exclusion, rollout, rollback, and verification. Its pure core:

- rejects missing, partial, ambiguous, unsafe, contradictory, and write-capable evidence;
- rejects production, adapter, deployment, and runtime-read claims;
- returns only a deterministic non-financial envelope and aggregate receipt summary;
- caps success at `ready_for_next_audit`; and
- is unmounted and invoked only from tests.

It has no Firestore, CLI, environment, route, job, scheduler, UI, infrastructure, IAM, provider, payment, or runtime dependency.

## 3. What Phase 0U proves

Phase 0U proves that, for an injected object:

- receipt and manifest versions can be checked deterministically;
- all ten required receipt categories can be required;
- claim scope can be limited to `next_audit_only`;
- receipt states and domain assertions can fail closed;
- reason codes and next steps can remain sorted and repeatable;
- input can remain unmodified;
- output can exclude financial, identity, path, credential, and provider fields; and
- complete synthetic receipts can support only the next audit discussion.

Its dependency and call-site tests prove the core itself is pure and test-invoked. They do not attest that supplied receipts are truthful, authorized, independently generated, or derived from complete source reads.

## 4. What Phase 0U does not prove

Phase 0U does not prove:

- that a JSON file is trusted, sanitized, size-bounded, or schema-valid before invocation;
- who created or approved a receipt;
- file ownership, symlink, traversal, race, or retention safety;
- that local credentials cannot be discovered by a wrapper;
- any production or preview Firestore record shape;
- exact query exhaustion, consistency, index deployment, or IAM denial in an environment;
- that an emulator artifact matches production behavior;
- that ordinary CI or developer workstations provide an acceptable execution identity;
- that logs and process errors cannot reveal the input path or raw content; or
- that an executable will remain outside application startup and deployment packaging.

The phrase `ready_for_next_audit` is an internal classification of supplied evidence, never an operational attestation.

## 5. Executable command adoption options

| Option | Decision | Reason |
| --- | --- | --- |
| Remain test-only | Safe baseline | Preserves all Phase 0U guarantees but does not validate packaging |
| Local wrapper over explicit sanitized JSON | Approve for Phase 0W | Exercises parsing, core invocation, exit codes, and bounded output without source access |
| Emulator-connected reader | Deferred | Requires query, projection, pagination, and boundary adapters not yet approved |
| CI executable over synthetic artifacts | Tests only | Useful for wrapper tests; must not become an operational readiness job |
| CI executable with project credentials | Prohibited | CI identity and environment evidence are not approved |
| Controlled admin/dev executable | Deferred | Dedicated host, identity, allowlist, logging, retention, and operator controls remain unproven |
| Production or application-runtime command | Prohibited | Would bypass the staged Firestore adapter and diagnostic-job gates |

Phase 0W is a packaging boundary, not an evidence-collection boundary.

## 6. Permitted execution contexts

### Local-only

Approved only with synthetic or already-sanitized receipt manifests stored inside a designated fixture/input directory. The wrapper must receive the file path explicitly, resolve it against an approved root, reject traversal/symlinks/non-regular files, enforce size limits, and avoid all ambient credentials and network access. It may not accept raw documents or real production extracts.

### Emulator-only

Phase 0W may consume a sanitized receipt file that a test fixture already produced. It may not start, detect, or connect to an emulator and may not inspect emulator variables. A future emulator receipt adapter requires a separate audit because producing receipts safely is materially different from consuming them.

### CI-only

CI may run unit/integration tests against synthetic temporary files. It must not invoke a package script as an operational scan, upload command output, use secrets or cloud identity, or mark a deployment/schema gate ready. CI test success proves wrapper behavior only.

### Controlled admin/dev context

Deferred. No current host proves dedicated short-lived identity, exact project binding, collection allowlists, negative permissions, network isolation, operator authorization, retention, or no-write telemetry. A developer laptop with application-default credentials is not a controlled context.

## 7. Firestore access decision

Firestore access remains fully deferred.

Phase 0W must not import `firebase-admin`, `@google-cloud/firestore`, application Firebase configuration, an authoritative source provider, or any module that initializes a client. It must not read an emulator or remote database, probe indexes, enumerate projects, or reuse migration/report helpers.

Existing migration scripts are not safe templates for accounting inventory because some use broad collection reads, post-read filtering or limiting, catch-to-empty behavior, ambient application credentials, and identifier-bearing reports. A future Firestore receipt adapter must first prove exact query predicates, immediate allowlist projection, pagination exhaustion, consistent-read boundary, typed failures, and dedicated read-only identity.

## 8. CLI execution decision

A narrow CLI wrapper is approved for Phase 0W, subject to all of these limits:

- one explicit `--input <path>` argument and optionally `--help`/`--version`;
- no default path, glob, directory scan, stdin stream, URL, inline JSON, interactive prompt, or multiple inputs;
- input restricted to a designated local fixture/input root;
- no output-path flag and no file persistence;
- stable exit codes for success-for-next-audit, non-ready, invalid invocation, invalid file, and internal failure;
- only the Phase 0U envelope on standard output;
- bounded generic errors on standard error, without input path, raw value, stack, or exception payload; and
- no subprocess, shell, network, plugin, dynamic import, or configuration discovery.

The command name and help text must state that it validates injected receipts only and does not inspect a database or establish operational readiness.

## 9. Environment access decision

Environment access remains deferred and prohibited in Phase 0W. The wrapper must not read `process.env`, `.env` files, Firebase configuration, project/database names, emulator host settings, CI variables, home-directory credentials, or cloud metadata.

Node version enforcement may remain in the existing outer package preflight; the new wrapper itself must not inspect environment variables. Tests must scan the wrapper and its direct imports for environment/config access. All behavior must come from fixed constants and the explicit sanitized input file.

## 10. Read-only permission requirements

Phase 0W requires no cloud permission because it performs no cloud read. Local filesystem permission must be limited to opening the explicitly resolved regular file under the approved input root. It must not list directories, follow symlinks, read outside the root, or write anywhere.

Before any future source-connected command, a dedicated short-lived identity must prove:

- exact environment/host binding;
- the narrowest feasible read authority;
- denied document, batch, and transaction writes;
- denied index/IAM administration, impersonation, long-lived keys, secrets, and storage;
- no provider/payment/external execution capabilities; and
- no broader identity fallback.

Successful reads are not negative-permission proof. Client Firestore rules do not constrain Admin SDK identities.

## 11. Output boundaries

Phase 0W may emit only the fields already returned by Phase 0U:

- `ok`;
- `inventoryStatus`;
- `commandCoreVersion`;
- `phase`;
- bounded `reasonCodes`, `warnings`, and `requiredNextSteps`;
- normalized `checkedAt`; and
- aggregate `receiptSummary`.

It must not echo input, add filenames/paths, environment/project values, operator identity, individual receipt bodies, record samples, IDs, financial values, dates tied to records, PII, bank data, credentials, provider references, raw errors, or readiness labels beyond the core result. Output ordering must be deterministic and JSON serialization must be bounded.

No Phase 0W output may be persisted or uploaded by the wrapper. Shell redirection by a developer is outside code control and must be discouraged in documentation; real evidence retention requires a separately governed design.

## 12. Operator controls

For Phase 0W, controls are local and preventative:

1. explicit invocation by a developer;
2. explicit single input path;
3. approved-root and regular-file validation;
4. maximum byte limit before parsing;
5. strict top-level JSON object validation;
6. no raw document fields in accepted input contracts;
7. no ambient configuration or network access;
8. deterministic exit codes and no retry loop;
9. output-boundary assertion before serialization; and
10. visible warning that the result supports only a later audit.

There is no admin role, production approval, allowlist, or runtime authorization in Phase 0W because those contexts are not permitted. Their absence must cause future broader invocation to remain deferred, not be simulated in local arguments.

## 13. Failure and fail-closed behavior

The wrapper must fail closed when:

- arguments are missing, duplicated, unknown, or malformed;
- the input path is absolute when only relative paths are allowed, escapes the approved root, is a symlink, is not a regular file, or exceeds the size limit;
- the file cannot be read exactly once;
- JSON is invalid, not an object, contains unsupported top-level fields, or cannot be passed unchanged to the core;
- serialization produces an unexpected field or excessive output;
- Phase 0U returns any status other than `ready_for_next_audit`; or
- any unexpected error occurs.

Non-ready core results should still be printed as bounded diagnostic envelopes with a nonzero exit code. Invocation/file/internal errors must emit only generic codes and no receipt data. The wrapper must not fall back to fixtures, another file, stdin, environment, network, or a broader path and must not retry.

## 14. Logging and observability boundaries

Phase 0W needs no telemetry service, audit collection, analytics event, or persistent log. Standard output is reserved for the result envelope. Standard error is reserved for a small fixed set of invocation/parser/internal error codes.

Do not log input paths, current working directory, usernames, hostnames, environment, argument arrays, receipt bodies, raw exception messages/stacks, timing tied to a real dataset, or filesystem metadata. Tests should capture both streams and assert exact output allowlists.

Operational logging for a future controlled context remains deferred until identity, retention, access control, redaction, correlation, and incident-handling rules are approved.

## 15. Test requirements before implementation

Phase 0W tests must cover:

- help/version and exact valid invocation;
- missing, duplicate, unknown, and malformed arguments;
- relative-path resolution under an isolated temporary approved root;
- traversal, absolute path, symlink, directory, special-file, missing-file, permission, race, and oversize rejection where portable;
- empty, invalid, array/scalar, unsupported-key, and deeply nested JSON rejection;
- complete, partial, missing, ambiguous, unsafe, contradictory, and unsupported-claim receipts through Phase 0U;
- exact exit-code mapping and deterministic stdout/stderr snapshots;
- no filename, path, environment, receipt body, financial field, ID, credential, or raw error leakage;
- no mutation or output files;
- no Firestore, Firebase, cloud SDK, environment/config, route, job, scheduler, UI, provider/payment, network, or subprocess dependency;
- invocation only through focused tests and the explicitly added local package script; and
- backend accounting suite and production TypeScript build.

An integration test may invoke the built local command with synthetic files. It must not require emulator or cloud services.

## 16. Manual/operator checklist if implemented

Before a local Phase 0W run:

1. confirm the input is synthetic or independently sanitized and contains receipts only;
2. confirm it resides under the approved local input root and is not a symlink;
3. confirm no cloud/emulator credentials or project access are needed;
4. invoke with the explicit single input path;
5. verify stdout contains only the Phase 0U envelope;
6. verify stderr is empty on success or contains only a fixed error code on failure;
7. verify no file was created or changed;
8. treat `ready_for_next_audit` as non-operational;
9. do not upload, attach, or redirect output to an unapproved location; and
10. do not use the command against production data or to authorize adapter work.

Manual product QA is not required because Phase 0W would have no route, UI, or runtime behavior.

## 17. Non-goals

- No executable implementation in Phase 0V.
- No Firestore/emulator connection, read, write, index probe, or adapter.
- No environment, `.env`, credential, project, or metadata access.
- No controlled-admin, production, runtime, route, job, scheduler, or UI invocation.
- No schema migration, backfill, infrastructure, index, IAM, or deployment change.
- No persisted reports, audit events, telemetry, or CI artifacts.
- No payment mutation, provider integration, Rotessa, PAD, bank data, or money movement.
- No landlord-visible financial read or existing ledger/payment behavior change.
- No balances, charges, payments, allocations, rent roll, aging, schedules, or tenant balances.
- No treatment of tenant rent as RentChain revenue.
- No model of RentChain-held funds, pooled rent accounts, trust custody, landlord payout liabilities, or settlement float.
- No RC1 demo behavior change.

## 18. Recommended next implementation PR, if safe

Approve:

`backend/phase-0w-receivables-schema-inventory-local-command-v1`

Phase 0W should add a minimal local wrapper, strict argument/file parser, fixed exit-code contract, synthetic fixtures, focused tests, and one clearly named local package script. The wrapper must call the existing Phase 0U core without changing its types or readiness ceiling.

Phase 0W must remain local-only, sanitized-file-only, non-mutating, non-financial, and outside application runtime. It must have no Firestore/Firebase/cloud SDK imports, environment reads, network/subprocess calls, output files, routes, jobs, schedulers, UI, infrastructure/IAM/index changes, or provider/payment behavior.

After Phase 0W, conduct a new docs-only audit before adding an emulator receipt producer, Firestore source adapter, controlled execution identity, or broader invocation context. If the wrapper cannot enforce the path, parser, output, and dependency boundaries above, Phase 0W should remain deferred and Phase 0U stays test-only.

## 19. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Local executable is mistaken for source inventory | State sanitized-receipt validation only in name/help/output |
| Wrapper discovers ambient cloud access | Prohibit environment/config/cloud imports and scan direct dependencies |
| Path traversal or symlink reads unintended files | Approved root, canonical resolution, regular-file and no-symlink checks |
| Raw or oversized input reaches the core | Byte limit, strict JSON/top-level validation, receipt-only contract |
| Output leaks path, IDs, financial data, or raw errors | Reuse exact core envelope and fixed stderr codes only |
| `ready_for_next_audit` becomes operational approval | Preserve warning, nonzero semantics for other states, separate reviewer gate |
| Emulator/CI success is overstated | Treat both as wrapper tests only, never environment evidence |
| Existing migration script patterns are reused | Do not reuse broad readers, ambient credentials, raw reports, or writers |
| Local wrapper quietly becomes a job or route | No runtime import; explicit local script only; call-site scans |
| Firestore adoption skips identity/query gates | Require a separate audit before any receipt producer or source connection |
| Accounting work drifts into payment execution | Keep provider, PAD, mutation, custody, and money movement out of scope |

Phase 0V therefore approves only the Phase 0W local sanitized-receipt wrapper. Firestore access, environment access, CI/admin execution, real evidence collection, and the receivables adapter remain deferred.
