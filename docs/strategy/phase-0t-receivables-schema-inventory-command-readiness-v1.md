# Phase 0T Receivables Schema Inventory Command Readiness v1

Status: readiness audit only; no schema-inventory command, Firestore read, adapter, route, job, or runtime behavior is authorized

## 1. Executive summary

RentChain needs a non-mutating schema inventory before a Firestore receivables adapter can be reconsidered. Phase 0R can classify supplied readiness claims, but Phase 0S confirmed that no independently produced evidence currently proves persisted schema, ownership, completeness, index, IAM, consistency, pagination, or redaction readiness.

A production-connected command is **not safe yet**. Existing migration/report scripts are useful operational references but are not accounting-evidence templates: some use broad collection reads, apply filters or limits after reads, convert failures to empty results, rely on ambient application credentials, and write identifier-bearing local reports.

The safe next implementation is `backend/phase-0u-receivables-schema-inventory-command-core-v1`: a pure, unmounted backend-only core over injected, versioned inventory receipts. It may validate manifests, classify per-collection field coverage, aggregate non-financial counts, and return deterministic reason codes. It must not import Firestore, read an environment, expose a CLI, prove real IAM/index deployment by assertion, or invoke Phase 0R as if synthetic evidence were operational proof.

An executable Firestore reader remains deferred for a later audit after the Phase 0U contract is proven. Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, payment processing, bank data, money movement, custody, pooled funds, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

Phases 0 through 0R provide pure accounting primitives, safe projections, legacy-source normalization, parity comparison, receipt-driven snapshot and provider cores, a diagnostic runner core, Firestore schema/query and rollout plans, and an injected-evidence readiness classifier. Phase 0S records a no-go for the Firestore adapter because evidence collection remains unproven.

All accounting implementation remains unmounted under `rentchain-api/src/lib/accounting`. It does not read or write Firestore, run a job or scheduler, mount a route, expose UI, or return landlord-visible financial totals. Phase 0N remains the receipt authority boundary and Phase 0R remains a classifier, not an evidence collector.

## 3. Why a schema-inventory command is needed before Firestore adapter work

Planning documents describe target fields and queries, but cannot establish what persisted records actually contain. A bounded inventory is needed to measure:

- canonical ownership and mapping-field coverage;
- supported schema/source revisions and field types;
- ambiguous, conflicting, unsupported, and restricted-field shapes;
- whether exact-scope query pages can be exhausted without post-read filtering;
- whether required indexes and read-only identity controls are independently attested; and
- whether Phase 0R evidence can be produced from reviewable facts rather than synthetic booleans.

The inventory is a diagnostic prerequisite, not the Firestore adapter and not financial accounting output. It cannot backfill data, infer authority, normalize records into transactions, or make the adapter ready by itself.

## 4. What the command would inspect

The future inventory contract should cover the Phase 0P sources separately:

| Source | Non-financial inspection |
| --- | --- |
| `leases` | canonical landlord, property, unit, party/responsibility, schema, and source-revision field presence/type |
| `properties` and `units` | canonical landlord/property mappings, supported revision, explicit missing/not-applicable states |
| `tenants` | supported mapping/revision fields and safe-label availability without accepting tenant records as lease authority |
| `ledgerEntries` | canonical scope, kind, currency/date/link/reversal field shape; never amounts or descriptions in output |
| `payments` and `rentPayments` | canonical scope/status/link/date/currency shape and overlap categories; never bank/provider values |
| `paymentIntents` | canonical scope/purpose/status/link/revision shape; intents never become posted evidence |
| `paymentReconciliationRecords` | exact canonical scope, subject/link/internal-state/revision shape |
| `leaseCreditAllocationRecords` | canonical scope, obligation/source/reversal/revision shape and append-safe field presence |
| Index evidence | checked-in query manifest identity plus independent target-environment deployment receipt |
| IAM evidence | independent identity/binding and negative-permission receipt; not credential inspection or secret access |

Inventory classification may count compatible, missing-field, wrong-type, conflicting, ambiguous, unsafe, unsupported, and unscannable records. It must not copy raw documents into memory beyond a bounded projection, derive balances, or inspect provider/bank payload contents.

## 5. Where the command may run: local, emulator, CI, controlled admin/dev context

### Pure Phase 0U core

The core may run in local tests and CI because it accepts injected fixtures/receipts only. CI may verify deterministic classification and output safety, but cannot claim production schema, index, or IAM readiness.

### Emulator

A later test harness may invoke the core with emulator-produced receipts. The emulator is appropriate for exact-query, pagination, error, and redaction fixtures. It does not prove production index build status, production IAM, persisted-data coverage, or production consistency behavior.

### Local developer context

Local execution against real projects is prohibited. Application-default credentials on a workstation, downloaded service-account keys, project-name guessing, and broad existing developer access are not acceptable controls.

### Controlled admin/dev context

A future executable may run only in a separately approved, isolated non-production execution context with a dedicated short-lived read-only identity, immutable manifest, exact environment binding, human initiation, default-off guard, bounded cost/record limits, abort thresholds, and approved retention. Production inventory requires another explicit audit and authorization after preview proof.

The command must never run from the application server, HTTP route, scheduler, deployment hook, ordinary CI credential, landlord/admin UI, or RC1 demo path.

## 6. Read-only permission requirements

The eventual execution identity must be dedicated and explicitly bound to the approved host and project. It must have the narrowest feasible Firestore read access and proven denial of:

- document create, update, delete, batch, and transaction writes;
- index, database, IAM, and service-account administration;
- service-account impersonation and long-lived key creation;
- Secret Manager and Cloud Storage access;
- provider, payment-execution, messaging, and external-network capabilities; and
- access to unapproved environments.

Firestore client rules do not restrict Admin SDK identities. If collection-level IAM cannot express the desired boundary, isolation, dependency removal, exact collection allowlists, organization controls, and negative-permission probes are required. The command must refuse unknown identity, project, database, manifest, or environment attestations.

Phase 0U must model these as injected evidence only; it must not perform IAM calls or imply the evidence is genuine.

## 7. Output boundaries

Permitted output is a versioned, deterministic, non-financial envelope containing only:

- command-core and manifest versions;
- approved environment classification, never project identifiers;
- run status and bounded reason/warning codes;
- per-source aggregate counts by readiness category;
- page/exhaustion/completeness status;
- index and IAM attestation status identifiers expressed as approved digests/versions;
- start/end timestamps or deterministic test timestamps; and
- required next-step categories.

Output must not include raw or hashed-without-approved-salt landlord, lease, tenant, property, unit, document, provider, reconciliation, allocation, or payment IDs; document/storage paths; names, emails, addresses, free text, dates tied to a record, amounts, balances, charges, payments, schedules, rent roll, aging, bank data, credentials, provider fields, raw error payloads, or sample documents.

Ordinary logs must be no richer than the returned envelope. Detailed incident evidence, if later needed, requires a separate protected artifact and retention approval.

## 8. How it proves schema readiness

Schema evidence must be derived from exhaustive, bounded allowlist projections and a versioned per-collection ruleset. For each approved source, receipts must report total examined, compatible, missing, wrong-type, unsupported-version, ambiguous, conflicting, unsafe-field, and unreadable counts plus source-boundary and exhaustion proof.

The command may show coverage facts; it may not declare records compatible when authority or financial linkage is inferred. Any accepted cross-landlord conflict, ownership alias, unsupported type, unknown schema version, unsafe field reaching the classifier, or incomplete scan prevents a `ready` claim. Repeated runs against the same immutable fixture/manifest must be identical.

Phase 0U can prove only that the classification rules transform injected receipts correctly. Real schema readiness remains unproven until a later approved reader produces independently reviewable receipts.

## 9. How it proves index readiness

Schema documents cannot prove index readiness. Required evidence must combine:

1. the versioned Phase 0P exact-query/index manifest;
2. checked-in configuration digest and review status;
3. an independently generated target-environment deployment receipt showing every required index `READY`;
4. exact query-to-index verification; and
5. preview multi-page query tests with no fallback query.

Emulator success, absence of an index error, console screenshots, or a self-asserted boolean is insufficient. Phase 0U may validate the shape and consistency of injected index receipts but cannot call infrastructure APIs or make deployment claims.

## 10. How it proves IAM/read-only execution identity readiness

The command must not inspect credentials, tokens, service-account JSON, or IAM policy payloads. IAM readiness requires an independent, versioned attestation that identifies the approved identity and environment by protected digest and records successful negative probes for every forbidden capability.

The attestation must prove short-lived workload binding, no broad identity fallback, no developer key, no write or privileged access, and reviewer approval. A successful Firestore read proves only some read access; it does not prove denial of writes or other services.

Phase 0U may reject missing, stale, conflicting, overly broad, or unsigned injected attestations. It cannot produce real IAM proof itself.

## 11. How it proves ownership/completeness evidence readiness

Ownership readiness requires canonical landlord and lease predicates at query time and exact persisted mappings among lease, property, unit, and responsible tenant/party evidence. Route context, user/session claims, property-manager membership, email, labels, aliases, document IDs, provider metadata, and in-memory/demo fallback are never proof.

Completeness receipts must record exact scope, deterministic ordering, page size, cursor progression, page count, boundary/revision, duplicate/gap detection, termination reason, and exhaustion. Confirmed empty is valid only after a successful exact-scope, boundary-consistent, exhausted read. Permission, missing-index, timeout, unavailable, cancellation, malformed projection, concurrency invalidation, cap, or unexpected error is not empty.

Catch-to-empty, post-read authority filtering, whole-collection reads, alias unions, silent limits, and limit-after-read patterns fail closed. Cross-collection readiness also requires the separately approved transaction or source-revision/high-watermark protocol.

## 12. How it avoids financial data exposure

Each raw document must be reduced immediately to a per-collection presence/type classification using explicit field allowlists. The reader must never pass amounts, dates tied to individual records, descriptions, raw statuses, provider payloads, bank/payment-method data, credentials, admin/support fields, PII, IDs, or paths to the Phase 0U core.

Counters must be protected against accidental identification of tiny cohorts. Any future controlled report must define suppression/bucketing rules and must not print sample records. Exceptions are mapped to bounded codes before logging. Fixtures must be synthetic or irreversibly redacted and reviewed for nested restricted fields.

## 13. How it avoids runtime product behavior changes

Phase 0U must live as pure library code with injected receipts and no CLI entrypoint, package script, Firebase import, environment lookup, file writer, network client, route registration, job/scheduler hook, startup import, or production source provider. Tests are its only invocation.

A later executable must remain an explicitly invoked diagnostic tool outside the product runtime. It cannot update Phase 0R evidence automatically, gate user requests, feed dashboard/ledger projections, persist results, or change existing lease, ledger, payment, RC1, or deployment behavior.

## 14. Failure and fail-closed behavior

The core and any future reader must return non-ready with deterministic reasons when:

- manifest, environment, identity, reviewer, version, expiry, or scope evidence is missing or conflicting;
- a collection, required direct document, page, or independent attestation is absent;
- ownership or mappings are ambiguous, aliased, cross-scope, or post-filtered;
- a query is capped, unordered, unexhausted, boundary-inconsistent, or converted to empty;
- an unsafe field reaches the receipt boundary;
- index/IAM claims are self-asserted, stale, unsigned, or incomplete;
- output suppression cannot preserve privacy; or
- any exception is unclassified.

Partial results may report `not_ready` aggregate categories but must never be relabeled as complete. Failure produces no financial data, no retry loop, no fallback identity/query, no persistence, and no mutation.

## 15. Test requirements before implementation

Phase 0U tests must cover:

- exact supported manifest/receipt versions and every missing, stale, conflicting, malformed, and unknown version;
- all source classes and readiness categories;
- complete, empty-confirmed, partial, capped, duplicate, gapped, reordered, concurrent-change, catch-to-empty, and post-filtered receipts;
- canonical ownership and every alias/cross-landlord/in-memory fallback rejection;
- unsafe fields in nested objects/arrays and output/log allowlist snapshots;
- index/IAM attestation validation without infrastructure or credential imports;
- deterministic aggregation, stable reason ordering, counter bounds, cohort suppression, and no IDs/financial values;
- compatibility mapping into Phase 0R evidence without declaring injected facts independently verified; and
- forbidden-dependency/runtime-invocation scans.

Later emulator tests must cover exact queries and pagination separately. Later negative-permission and deployed-index tests require an approved non-production identity/environment and are not Phase 0U scope.

## 16. Manual/operator checklist if implemented

No manual QA is required for the pure unmounted Phase 0U core. Before any later executable is used, an operator must verify:

1. approved change/run ticket, reviewer, manifest, environment, project/database binding, and expiry;
2. dedicated short-lived identity and completed negative-permission evidence;
3. exact collection/query allowlist and deployed index readiness;
4. default-off state, bounded record/read/cost/time limits, and abort thresholds;
5. no production application, route, scheduler, CI, developer workstation, or broad service identity invocation;
6. output/log redaction and cohort suppression;
7. typed failure behavior using emulator/preview fault injection;
8. no Firestore writes or calls to provider/payment/external services;
9. approved retention and secure destination for the non-financial envelope; and
10. post-run read-count, failure, output, and no-mutation verification.

Production use requires a separate explicit authorization and checklist review.

## 17. Non-goals

- No schema-inventory executable, Firestore adapter, or runtime Firestore read/write.
- No schema migration, backfill, index, infrastructure, IAM, credential, or deployment change.
- No route, job, scheduler, CLI entrypoint, package script, UI, or persistence.
- No Phase 0K runtime invocation or automatic Phase 0R readiness update.
- No payment mutation, provider integration, Rotessa, PAD, bank data, or money movement.
- No landlord-visible financial reads or changes to existing ledger/payment behavior.
- No balances, charges, payments, allocations, rent roll, aging, receivable schedules, or tenant balances in output.
- No treatment of tenant rent as RentChain revenue.
- No model of RentChain-held funds, pooled rent accounts, trust custody, landlord payout liabilities, or settlement float.
- No RC1 demo behavior change.

## 18. Recommended next implementation PR, if safe

Approve only:

`backend/phase-0u-receivables-schema-inventory-command-core-v1`

Phase 0U should add pure types, a deterministic classifier/aggregator, synthetic fixtures, and focused tests under `rentchain-api/src/lib/accounting`. It should accept injected versioned inventory, index-attestation, and IAM-attestation receipts and emit only the non-financial envelope defined here.

Phase 0U must remain unmounted and test-invoked only. It must not import Firestore/Firebase/Google Cloud SDKs; inspect process environment, credentials, IAM, or indexes; add a CLI/package script/file output; or claim real schema/index/IAM readiness. A forbidden-dependency and runtime-invocation scan is required.

After Phase 0U, a new docs-only audit must decide whether an emulator/preview receipt adapter and controlled executable can be designed safely. The Firestore adapter remains deferred.

## 19. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| A report script is treated as safe because it is non-mutating | Separate no-write behavior from read authority, completeness, privacy, and identity proof |
| Existing migration helpers are reused | Do not reuse broad reads, post-filtering, catch-to-empty, ambient credentials, or raw reports |
| Phase 0U synthetic receipts become production claims | Label injected evidence and require independent later collection/review |
| Inventory leaks IDs or financial/PII fields | Immediate allowlist classification, aggregate-only output, suppression, bounded logs |
| A successful read is treated as IAM proof | Require independent negative-permission and workload-binding attestation |
| Emulator success is treated as index proof | Require deployed target-environment readiness receipts and query verification |
| Caps or failures become empty | Typed failures, deterministic pagination, explicit exhaustion, fail closed |
| Ownership is inferred from aliases/context | Canonical persisted predicates and exact mappings only |
| Tool becomes a hidden runtime job | Pure test-only core first; separate audit before any executable |
| Inventory silently authorizes adapter work | Phase 0R plus independent reviewers and every Phase 0S gate remain required |
| Accounting work drifts into payment execution | Keep provider, PAD, mutation, custody, and money movement outside scope |

Phase 0T therefore approves only a pure Phase 0U inventory-command core contract. It does not approve an executable inventory command, Firestore access, or the Firestore receivables adapter.
