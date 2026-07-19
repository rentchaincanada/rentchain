# Phase 0Q Receivables Firestore Schema Migration, Index, and IAM Rollout v1

Status: rollout audit only; no schema write, backfill, index, IAM, infrastructure, Firestore adapter, runtime read, job, route, or deployment change is authorized

## 1. Executive summary

RentChain is not ready to implement the Firestore source adapter or to deploy the Phase 0P schema, indexes, or IAM changes as one combined change.

Phase 0P defines a credible target contract, but the repository still lacks measured persisted-data compatibility, a reviewed mutation manifest, deployed query indexes, a cross-collection read-boundary design, and a dedicated read-only execution identity. The current migration utilities offer useful dry-run/report conventions, but they are not sufficient for accounting evidence: several load full collections, apply limits after reads, use alias normalization, or catch failed reads as empty. The current Terraform declares a `service_account` variable without binding it to the Cloud Run service, defines no collection-specific Firestore read-only identity, and the checked-in Cloud Build deployments do not specify a runtime service account.

Implementation must therefore be split into independently reviewable, reversible gates:

1. pure schema-readiness classification over injected records;
2. read-only inventory and conflict reporting in an approved environment;
3. separately authorized append-safe schema backfill with quarantine;
4. additive index deployment and readiness verification;
5. dedicated read-only identity and negative-permission verification;
6. consistent-read/high-watermark proof; and only then
7. an unmounted, default-off Firestore source adapter.

Only the first step is safe to implement next: `backend/phase-0r-receivables-schema-readiness-classifier-v1`, a pure backend-only classifier with fixtures and no Firestore dependency. All runtime reads, writes, indexes, IAM changes, and adapter implementation remain deferred.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, provider execution, tenant bank data, money movement, custody, pooled funds, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

The accounting foundation now includes deterministic receivables primitives, a landlord-safe DTO assembler, a legacy-source normalizer, a disabled comparator, a source-snapshot adapter, a pure diagnostic runner core, an authoritative receipt-driven provider core, a Firestore adapter readiness audit, and the Phase 0P schema/exact-query plan.

All accounting implementation remains pure and unmounted under `rentchain-api/src/lib/accounting`. It does not read or write Firestore, run a job, mount a route, expose a UI, or return landlord-visible financial totals.

Phase 0P established the target source classes and required compound queries for:

- direct lease/property/unit/tenant mapping;
- `ledgerEntries`;
- `payments` and `rentPayments`;
- `paymentIntents`;
- `paymentReconciliationRecords`;
- `leaseCreditAllocationRecords`;
- versioned obligation derivation; and
- independent legacy parity effects.

Phase 0Q governs how that target could be introduced without silently converting legacy aliases, partial evidence, or broad service credentials into accounting authority.

## 3. Why rollout planning must precede schema/index/IAM changes

Schema, index, and IAM changes have different failure and rollback characteristics:

- schema backfills mutate authoritative persisted records and can create false ownership or evidence links;
- indexes are additive operational infrastructure that may take substantial time to build and affect write/storage cost;
- IAM changes alter production authority and can accidentally grant writes, broad enumeration, Storage, provider, or secret access;
- adapter code can make incomplete data appear financially authoritative if deployed before every prerequisite is ready.

Combining them would obscure causality, make rollback ambiguous, and weaken review. The rollout must preserve these invariants:

- legacy records stay diagnostically ineligible until explicitly proven compatible;
- no backfill guesses ownership, tenant responsibility, amounts, dates, currency, or links;
- no reader depends on a new index before it reports ready in the target environment;
- no workload gains broader permissions than its exact diagnostic task;
- no current route, ledger, payment, or RC1 behavior consumes the new fields; and
- every phase can stop without requiring the next phase to preserve existing behavior.

## 4. Schema migration requirements

### 4.1 Compatibility classifier first

Before any Firestore scan or write, implement a pure classifier that accepts injected raw record shapes and returns only bounded readiness categories:

- `already_compatible`;
- `deterministically_backfillable`;
- `conflict_quarantine_required`;
- `unsupported_schema`;
- `unsafe_source_data`; or
- `manual_accounting_review_required`.

The classifier must be versioned per collection, deterministic, side-effect free, and tested against real-shaped redacted fixtures. It must not infer missing data from IDs, labels, email, route context, current user, property manager membership, amount/date similarity, or provider metadata.

### 4.2 Target collections and fields

The migration manifest must separately cover:

| Collection | Required target fields | Prohibited inference |
| --- | --- | --- |
| `leases` | canonical `landlordId`, property/unit/party/responsibility fields, rent cents, CAD/monthly terms, schema/source revision | owner aliases, email/session, silent proration |
| `properties` | canonical `landlordId`, supported schema/source revision, safe label | manager/staff access as ownership |
| `units` | canonical landlord/property scope, explicit assigned/not-applicable state, safe label | unit number/label lookup as identity |
| `tenants` | supported schema/source revision and safe label | tenant document overriding lease responsibility |
| `ledgerEntries` | canonical scope, entry kind, cents, currency/date, event/link/reversal fields, schema/revision | notes/reference/provider metadata as evidence |
| `payments` | canonical scope, cents, currency/date, stable ledger link, schema/revision | tenant/date/amount heuristic linking |
| `rentPayments` | canonical scope, supported internal status and links, schema/revision | provider session/payment status as authority |
| `paymentIntents` | canonical scope, purpose/status/dates/links, schema/revision | intent becoming a posted transaction |
| `paymentReconciliationRecords` | canonical scope, subject kind/ID, exact internal links, internal state, schema/revision | broad subject joins or provider identity |
| `leaseCreditAllocationRecords` | canonical scope, obligation/source links, cents/currency, append-safe reversal state, schema/revision | overwriting originals or dropping reversal history |

Obligations remain a versioned derivation from accepted lease/evidence records. This rollout does not create an obligation collection.

### 4.3 Migration behavior

Any future backfill must:

- default to dry-run;
- require exact environment, manifest version, approved collection, and bounded scope;
- use deterministic document selection and cursor checkpoints;
- record before/after hashes without exporting raw financial or personal fields;
- use compare-and-set preconditions on the exact read version;
- write only additive canonical/version fields unless a separate migration authorizes more;
- never delete or rewrite append-safe accounting history;
- quarantine conflicts rather than choose a winner;
- be idempotent and resumable from an immutable manifest;
- support a maximum-record and maximum-error stop threshold; and
- require separate operator approval to move from report-only to writes.

The existing lease migration utilities are reference patterns, not safe reusable proof. Their full-collection reads, alias normalization, post-read filtering, limit slicing, and catch-to-empty behavior must not be copied into receivables migration tooling.

## 5. Index requirements

Phase 0P requires additive compound indexes for exact landlord/lease scope and deterministic ordering:

| Collection | Required index |
| --- | --- |
| `ledgerEntries` | `landlordId ASC, leaseId ASC, effectiveDate ASC, __name__ ASC` |
| `payments` | `landlordId ASC, leaseId ASC, effectiveDate ASC, __name__ ASC` |
| `rentPayments` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |
| `paymentIntents` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |
| `paymentReconciliationRecords` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |
| `leaseCreditAllocationRecords` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |

Index rollout requirements:

1. keep the index PR additive; do not remove or reorder unrelated indexes;
2. validate JSON/config syntax and exact query-to-index matching;
3. deploy to preview first through the governed Firebase index process;
4. wait for every index to report ready before query verification;
5. test empty, single-page, multi-page, boundary, and cap cases with realistic volume;
6. capture query latency, read counts, write latency, index storage, and error baseline;
7. obtain an explicit production infrastructure gate;
8. deploy production indexes while no runtime code depends on them; and
9. verify deployed configuration against the checked-in registry before adapter work begins.

The emulator does not enforce all production index behavior. Emulator query success is necessary but not sufficient. No Phase 0 query may be mounted while an index is building or absent.

## 6. IAM/read-only execution identity requirements

The repository currently does not prove a dedicated receivables diagnostic identity:

- the Terraform `service_account` variable is not attached to the Cloud Run template;
- no receivables-specific service account or datastore role binding is declared;
- Cloud Build deploy commands do not specify a runtime service account; and
- the current application service may carry broader ambient authority than the future diagnostic task permits.

The target identity must:

- be a dedicated service account/workload identity for the future internal diagnostic runner;
- be bound explicitly to the intended execution host and environment;
- read only the approved Firestore database/collections to the extent supported by the selected IAM/security architecture;
- have no create, update, delete, batch, transaction-write, index-admin, IAM-admin, Secret Manager, Storage, provider, payment-execution, impersonation, or service-account-key creation permissions;
- have no long-lived downloaded key;
- be unusable from developer machines by default;
- use short-lived workload identity credentials;
- keep exact landlord/lease allowlist and manifest enforcement in application code; and
- emit only non-financial access/decision telemetry.

Because standard Firestore IAM roles may operate at database/project scope rather than arbitrary collection scope, the IAM design must be reviewed against actual Google Cloud capabilities. If least privilege cannot be expressed directly, isolate the execution host, remove write APIs from its dependency surface, use explicit read-only application adapters, apply organization/policy controls where available, and prove all negative permissions. Client Firestore rules do not constrain Admin SDK access and are not an IAM substitute.

Required negative tests include denied document writes, batch writes, transactions with writes, index administration, secret reads, Storage reads/writes, service-account impersonation, provider calls, and access outside the approved project/environment.

## 7. Deployment sequencing

The rollout order is mandatory:

### Gate A — pure readiness logic

1. Implement the pure schema-readiness classifier over injected fixtures.
2. Prove deterministic categories, unsafe-field rejection, and no Firestore/runtime imports.

### Gate B — read-only inventory design and execution

3. Audit a future report-only inventory command and manifest.
4. Implement it separately with explicit environment guard, exact bounded queries, no catch-to-empty, no writes, and redacted aggregate output.
5. Run first against emulator fixtures, then preview with explicit operator approval.
6. Review coverage/conflict/quarantine metrics before any production read or write.

### Gate C — schema compatibility rollout

7. Approve per-collection backfill manifests separately.
8. Run production report-only inventory with approved credentials and retention controls.
9. Quarantine ambiguous records and set a go/no-go threshold.
10. Execute bounded additive backfills collection by collection only after dry-run sign-off.
11. Re-run inventory and source-equivalence fixtures after each collection.

### Gate D — indexes

12. Add the six indexes in a dedicated infrastructure PR.
13. Deploy and verify preview readiness/performance.
14. Deploy to production while no runtime reader depends on them.
15. Verify ready status and configuration parity.

### Gate E — read boundary and identity

16. Approve and implement the source-revision/high-watermark protocol.
17. Create and bind the dedicated read-only identity in a separate IAM/infrastructure PR.
18. Run negative-permission and environment-binding tests.

### Gate F — adapter reconsideration

19. Re-audit compatibility, indexes, IAM, consistency, and rollback evidence.
20. Only then consider an unmounted, default-off Firestore adapter PR.

No gate may be collapsed merely because later work is ready. Failure or uncertainty at any gate leaves Phase 0N receipt-driven and library-only.

## 8. Backfill and readiness checks

### Pre-backfill report

For every target collection, the report must provide non-financial aggregate counts for:

- total scanned under the immutable manifest;
- already compatible;
- deterministically backfillable;
- conflict quarantine required;
- unsupported schema;
- unsafe source data;
- manual accounting review required;
- missing canonical ownership/scope/link fields; and
- source-revision coverage.

No ordinary report may contain landlord, lease, tenant, property, unit, document, provider, storage, bank, or credential identifiers. A separately protected incident artifact may use irreversible digests only if operationally necessary and retention-approved.

### Go/no-go rules

Backfill is blocked when:

- the scan is incomplete, capped, post-filtered, or boundary-inconsistent;
- any ownership value requires guessing;
- conflicting aliases or cross-landlord mappings remain unresolved;
- payments/reconciliation/allocations cannot be linked exactly;
- unsafe fields enter the proposed projection;
- source revision/precondition behavior is unavailable;
- dry-run and repeated dry-run outputs are nondeterministic; or
- rollback evidence and operator authorization are missing.

There is no acceptable percentage threshold for false ownership, cross-scope evidence, or unsafe-field leakage. Those categories require zero accepted records; affected records remain quarantined/ineligible.

### Post-backfill checks

- repeat the exact inventory manifest;
- prove only approved fields changed;
- prove every write precondition matched;
- prove no append-safe record was deleted or mutated semantically;
- compare before/after classification counts;
- run Phase 0E equivalence fixtures on representative redacted shapes;
- verify existing ledger/payment routes remain behaviorally unchanged; and
- retain a bounded non-financial audit manifest under an approved retention policy.

## 9. Emulator and automated test requirements

### Pure classifier tests

- all target collection/schema versions;
- compatible, backfillable, conflicting, unsupported, unsafe, and manual-review outcomes;
- ownership aliases and cross-scope conflicts;
- tenant responsibility ambiguity;
- amount/date/currency/type/status/link validation;
- append-safe reversal/write-off/allocation chains; and
- deterministic output and reason codes.

### Migration planner tests

- dry-run default and write-mode explicit gate;
- immutable manifest validation;
- idempotency and compare-and-set preconditions;
- pagination, exhaustion, cap, retry, and checkpoint handling;
- conflict quarantine without guessing;
- no raw identifiers or financial values in standard reports;
- restart after boundary change; and
- no deletion or broad merge behavior.

### Emulator tests

- exact landlord+lease query shapes for all six evidence collections;
- direct ownership/mapping reads;
- zero, one, and multiple pages;
- concurrent mutation invalidating the boundary;
- missing/unsupported record failures;
- unsafe field rejection before Phase 0N;
- repeated dry-run equivalence; and
- explicit proof that emulator configuration cannot reach production.

### Static/negative tests

- no route, job, scheduler, UI, provider, or payment imports;
- no adapter runtime invocation;
- no credentials or secret-bearing configuration;
- exact changed-file/scope scans for each split PR; and
- production IAM negative tests documented separately because the emulator cannot prove Admin SDK IAM.

## 10. Production safety checks

Before any approved production inventory or backfill:

- confirm exact project, database, environment, revision, manifest, and operator authorization;
- use short-lived approved credentials from the controlled execution host;
- verify production-local guardrails cannot be bypassed accidentally;
- verify current backups/export and recovery authority without creating a broad raw-data export for this mission;
- establish rate, batch, duration, record, and error limits;
- establish a kill switch that stops new work without reverting successful append-safe changes;
- monitor Firestore read/write errors, latency, quota, and index status without logging payloads;
- prohibit concurrent schema writers or require compare-and-set conflict rejection;
- use a small allowlisted canary scope before a larger approved scope; and
- require human review between canary and each expansion.

Before IAM activation, verify the bound runtime identity, token audience, project, environment, and denied permissions. Before index deployment, verify no runtime path depends on the new indexes. Before adapter work, verify every prerequisite artifact is complete and current.

## 11. Rollback plan

Rollback is phase-specific:

### Classifier/inventory

Remove or disable the unmounted tool. It has no persisted effect. Preserve only approved non-financial validation artifacts.

### Schema backfill

Prefer forward correction over blind reversal. Because canonical fields may be consumed by later phases, rollback must use the immutable before-hash/field-presence manifest, exact document preconditions, and a separately authorized correction plan. Never delete accounting history or restore stale whole documents. Conflicted records return to ineligible/quarantine state.

### Indexes

Do not delete a new index while any query depends on it. Since indexes must deploy before readers, the first rollback is to stop rollout and leave the unused additive index in place. Removal requires a separate usage check, preview test, production gate, and monitoring window.

### IAM

Disable invocation, remove the execution-host binding, and revoke the dedicated identity’s role bindings. Do not fall back to a broader application identity. Verify token invalidation/expiry and denied access after revocation.

### Future adapter

Keep it default-off and unmounted. Rollback is disablement/removal; it must never require reversing schema, index, or accounting data to restore current production behavior.

Rollback authority remains manual and separately approved. No script in this sequence autonomously reverts production data, IAM, or indexes.

## 12. Verification plan

Each gate requires evidence:

| Gate | Required evidence |
| --- | --- |
| Pure classifier | focused tests, build, forbidden-import scan, deterministic fixtures |
| Inventory | emulator tests, repeated dry-run digest, exact scope/exhaustion proof, redacted report review |
| Backfill | approved manifest, canary before/after proof, preconditions, idempotency, zero unauthorized mutations |
| Index preview | deployed ready status, query coverage, latency/read/write baseline, drift comparison |
| Index production | ready status for all indexes, configuration parity, no runtime dependency/regression |
| IAM | explicit binding, short-lived identity, denied writes/secrets/storage/provider/impersonation, environment binding |
| Read boundary | concurrent-change tests, restart behavior, one compatible boundary across receipts |
| Adapter reconsideration | independent readiness audit proving all prior gates and no unresolved quarantine in allowlisted scope |

Repository validation for each PR must include relevant targeted tests/builds, `git diff --check`, exact file scope, forbidden-scope scans, and clean synchronized branches. Infrastructure changes additionally require plan/review evidence and live environment verification. Manual UI QA is unnecessary until a user-visible surface is separately authorized.

## 13. Split-PR recommendation

Do not combine schema logic, production inventory, writes, indexes, IAM, or adapter code.

Recommended sequence:

1. `backend/phase-0r-receivables-schema-readiness-classifier-v1` — pure injected-record classifier and fixtures only;
2. `audit/phase-0s-receivables-schema-inventory-command-readiness-v1` — docs-only command/manifest/security audit;
3. future backend report-only inventory command — controlled, read-only, no writes, separately approved;
4. separate per-collection schema/backfill PRs after production inventory evidence;
5. one additive Firestore index PR with preview then production gates;
6. one read-boundary protocol PR, pure/unmounted before runtime adoption;
7. one IAM/infrastructure PR for the dedicated execution identity;
8. a fresh adapter readiness audit; and
9. only then a backend-only unmounted adapter PR.

Schema writers must not be bundled with index or IAM changes. Index deployment must not be bundled with adapter code. IAM must not be bundled with a runnable job or public route. This separation keeps rollback and review authority intelligible.

## 14. Non-goals

- no Firestore adapter, runtime reader, production source provider, or comparator invocation;
- no schema migration, backfill, production inventory, Firestore read, or write;
- no index, IAM, Terraform, Cloud Build, infrastructure, CI, or deployment change;
- no diagnostic job, scheduler, route, endpoint, UI, export, or landlord-visible financial read;
- no existing ledger/payment behavior change;
- no payment mutation, provider integration, Rotessa, PAD, tenant bank data, or money movement;
- no custody, pooled rent account, trust custody, landlord payout liability, or settlement float model;
- no treatment of tenant rent as RentChain revenue; and
- no RC1 demo behavior change.

## 15. Recommended next PR, if safe

The only implementation approved by this audit is:

`backend/phase-0r-receivables-schema-readiness-classifier-v1`

Boundary:

- backend-only under `rentchain-api/src/lib/accounting`;
- pure functions over injected unknown/raw record fixtures;
- versioned collection-specific compatibility classifications and deterministic reason codes;
- no Firebase/Firestore/Admin SDK imports;
- no runtime reads or writes;
- no route, job, scheduler, CLI, UI, infrastructure, IAM, index, or deployment changes;
- no financial output outside test/internal classification inputs;
- no adapter/comparator/runner runtime invocation; and
- focused tests for every compatible, backfillable, conflict, unsupported, unsafe, and manual-review condition.

All other implementation remains deferred. In particular, a Firestore inventory command, any schema write, the six indexes, IAM bindings, and the adapter each require later explicit authorization after their preceding gate is proven.

## 16. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Backfill invents ownership | Pure classifier first; conflicts quarantined; no alias guesses |
| Partial scan declared complete | Exact queries, cursor exhaustion, caps fail closed |
| Dry-run differs from write mode | Same planner/manifest; write mode only applies precomputed eligible operations |
| Concurrent writers invalidate plan | Source revision and compare-and-set preconditions |
| Accounting history rewritten | Additive fields only; append-safe records never deleted/semantically replaced |
| Reconciliation links guessed | Exact internal links required; ambiguous records remain ineligible |
| Index deployed with runtime dependency | Index-first deployment while no reader is mounted |
| Index rollback breaks queries | Disable readers first; separate removal gate |
| Cloud Run uses broad ambient identity | Dedicated explicit identity; never fall back to general service identity |
| IAM role still permits writes | Negative permission tests and isolated dependency surface |
| Admin SDK bypasses client rules | Treat IAM/application gates as authority; rules are not proof |
| Sensitive data appears in reports/logs | Aggregate non-financial output and immediate allowlist/redaction |
| Production credentials used locally | Emulator defaults and environment guard remain mandatory |
| One PR hides multiple irreversible changes | Split schema, indexes, IAM, boundary, and adapter work |
| Roadmap mistaken for live payment capability | Preserve future-only direct-settlement language and explicit non-goals |

## Decision

Phase 0Q provides a safe rollout order but does not authorize schema, index, IAM, runtime read, or adapter changes. A pure schema-readiness classifier may proceed as Phase 0R. Production inventory, backfill, index deployment, execution identity, consistent-read protocol, and the Firestore adapter remain separate, sequentially gated future work.
