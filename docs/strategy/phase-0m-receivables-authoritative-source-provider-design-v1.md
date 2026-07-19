# Phase 0M Receivables Authoritative Source Provider Design v1

Status: architecture audit only; no source provider, Firestore adapter, job, route, persistence, or runtime invocation is authorized

## 1. Executive summary

RentChain can proceed with a narrowly scoped Phase 0N **provider core**, but not with a production Firestore source provider or diagnostic job.

The repository contains candidate authoritative stores for lease, property, unit, tenant, ledger, payment, intent, reconciliation, obligation, and allocation evidence. It does not yet contain one read path that proves all of the following together:

- canonical lease ownership without in-memory/demo fallback or legacy-owner guessing;
- exact property, unit, tenant, and responsibility mappings;
- complete reads across every overlapping financial evidence family;
- an independent legacy signed-effect projection;
- one compatible as-of/read boundary;
- explicit pagination/query-success receipts;
- safe field projection before Phase 0I input;
- read-only authorization constrained to an approved landlord/lease manifest.

Several existing operational helpers are unsuitable for financial diagnostics because they catch query failures as `null` or empty arrays, apply post-read landlord filtering, rely on legacy owner aliases, cap queries without proving exhaustion, or mix provider identifiers into normalized records. They are useful inventory references, not reusable authority proof.

The safe next implementation is `backend/phase-0n-receivables-authoritative-source-provider-core-v1`: a pure, unmounted backend module over injected read-port results. It should validate exact scope, source-family receipts, mappings, query completeness, read/as-of compatibility, and safe whitelist projections, then produce a Phase 0I `ReceivablesSourceSnapshotAdapterInput`. It must not import `db`, read Firestore, register a job, or invoke Phase 0K from runtime.

A concrete Firestore read adapter requires a later audit after the provider core proves the contracts. Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture; Rotessa, PAD, bank data, provider execution, money movement, custody, pooled funds, settlement float, and payout liabilities remain out of scope.

## 2. Current accounting foundation recap

The foundation now includes:

- **Phase 0 / PR #1396:** deterministic receivable transaction, schedule, balance, aging, rent-roll, fingerprint, and reversal primitives;
- **Phase 0B / PR #1397:** accounting read-model surface separation;
- **Phase 0C / PR #1398:** landlord-safe lease-receivables DTO assembly and legacy equivalence;
- **Phase 0D / PR #1399:** route/ownership/completeness/equivalence gates;
- **Phase 0E / PR #1400:** legacy evidence contracts, precedence, deduplication, and fail-closed normalization;
- **Phase 0F / PR #1401:** shadow-route readiness boundaries;
- **Phase 0G / PR #1402:** pure default-off, exact-allowlist, non-financial comparator;
- **Phase 0H / PR #1403:** library-only adoption decision;
- **Phase 0I / PR #1404:** pure source-snapshot adapter and independent legacy-effect input;
- **Phase 0J / PR #1405:** internal diagnostic readiness plan;
- **Phase 0K / PR #1406:** pure unmounted diagnostic runner core;
- **Phase 0L / PR #1407:** decision that a runnable job remains unsafe pending source/read authority.

No receivables provider, job, route, UI, Firestore write, or financial read exposure has been mounted. Existing ledger and RC1 demo behavior remain unchanged.

## 3. Why source-provider design must precede implementation

Phase 0I validates an injected snapshot; it cannot prove how the caller obtained or omitted records. Phase 0K validates injected operator/allowlist intent and orchestrates Phase 0I/0G; it cannot turn caller assertions into runtime authority.

Without a designed source boundary, implementation would risk:

- treating the in-memory `leaseService` as ownership proof;
- accepting `landlordId`, `ownerId`, or `userId` aliases opportunistically;
- reading a lease by multiple identifiers and choosing the first match;
- filtering cross-landlord financial records after broad queries;
- treating query error, permission denial, timeout, cap, or missing index as empty evidence;
- double-counting overlapping `ledgerEntries`, `payments`, `rentPayments`, and payment intent/reconciliation records;
- using provider/session IDs or admin metadata as output/source identity;
- deriving both sides of parity from the same Phase 0 calculation;
- mixing records from incompatible read times;
- silently excluding reversals, allocations, write-offs, or obligations.

The provider contract must make omissions and uncertainty representable before a Firestore implementation is considered.

## 4. Required authoritative ownership sources

### Candidate stores

| Entity | Candidate store | Authority requirement |
| --- | --- | --- |
| Lease | `leases/{canonicalLeaseId}` | Direct document must exist and carry one approved canonical landlord relation |
| Property | `properties/{propertyId}` | Direct document must prove the same landlord/owner authority as the lease |
| Unit | `units/{unitId}` | Direct document must match property and landlord, or lease must explicitly be unit-not-applicable |
| Tenant | `tenants/{tenantId}` | Direct document identifies the party; authority comes from exact lease linkage, not email |
| Responsibility | Lease party/responsibility fields or a future canonical responsibility record | Must resolve one supported responsibility identity or fail closed |

The authoritative chain is lease -> landlord plus lease -> property -> landlord. Unit and tenant relationships are subordinate mappings, not alternative ownership sources.

An operator identity, service account, allowlist, property manager relationship, tenant email, route parameter, financial record, or in-memory object cannot independently prove lease ownership.

### Unresolved schema gate

The checked-in `LeaseRecord` model does not declare `landlordId`, while production-facing code reads combinations of `landlordId`, `ownerId`, and `userId`. Before a real adapter is approved, one canonical ownership field and legacy-transition rule must be documented and fixture-proven. Ambiguous or conflicting aliases must fail; the provider must not select whichever alias matches the caller.

## 5. Lease-to-landlord mapping requirements

The provider must:

1. receive one exact canonical landlord ID, lease ID, context, and as-of date from an already validated manifest;
2. read only `leases/{leaseId}` for canonical proof in the first version;
3. reject absent direct documents rather than query `id`/`leaseId` aliases automatically;
4. require the approved canonical landlord field to equal the manifest landlord exactly and case-sensitively;
5. reject conflicting `landlordId`/legacy owner aliases even when one matches;
6. require canonical property ID and supported lease status/billing terms;
7. verify the property independently under the same landlord authority;
8. derive `proofSource: authoritative_lease` only after lease and property checks pass;
9. preserve document version/update evidence for consistency checks without exposing paths;
10. return missing, conflict, ambiguity, unsupported-schema, and unavailable as distinct typed failures.

Legacy lease documents that cannot meet this contract are ineligible for diagnostics until separately normalized or migrated. The provider must not repair them.

## 6. Property/unit/tenant mapping requirements

### Property

- direct property document ID must equal the lease property ID;
- the canonical property ownership field must match the lease landlord;
- manager/staff access may authorize a read but does not replace owner/landlord accounting scope;
- conflicting ownership fields deny the snapshot;
- display name/address may be projected only through the Phase 0I-required safe label fields.

### Unit

- when the lease has a canonical unit ID, read that direct unit document;
- require exact property and landlord match;
- do not derive unit identity from display number alone;
- reject a unit referenced by a different property or landlord;
- `not_applicable` is allowed only when the lease schema explicitly supports no unit—not when a query fails.

### Tenant/responsibility

- use canonical lease party IDs (`tenantId`, `primaryTenantId`, or `tenantIds`) only under an explicit versioned precedence policy;
- reject conflicting primary/array mappings and cross-lease tenant pointers;
- never map by email, name, invite, or current-session identity;
- direct tenant document existence is supporting mapping evidence, not landlord ownership proof;
- require one responsibility record/identity compatible with Phase 0I; if current leases cannot produce it deterministically, mark mapping incomplete;
- do not expose tenant PII beyond the safe display value Phase 0I presently requires.

## 7. Financial evidence source inventory

The future provider must query all applicable source families even when some are confirmed empty.

| Phase 0E family | Candidate stores/helpers | Design treatment |
| --- | --- | --- |
| Ledger entries | `ledgerEntries` | Primary posted charge/payment/adjustment/write-off/reversal evidence; exact landlord + lease query required |
| Payment records | `payments`, `rentPayments` | Overlapping legacy/canonical evidence; query both under exact scope and preserve linkage for Phase 0E dedupe |
| Payment intents | `paymentIntents` | Obligation/execution intent only; must never invent a posted transaction |
| Reconciliation | `paymentReconciliationRecords` | Evidence/links only; subject/payment-intent mapping must be proven; provider fields excluded |
| Lease obligations | Lease billing terms plus supported obligation/payment-intent evidence | Derived evidence family with versioned rules; not assumed to be a standalone authoritative collection |
| Allocations | `leaseCreditAllocationRecords` | Append/reversal-safe allocation evidence; exact landlord + lease query |
| Independent legacy effects | Separate projection from raw eligible legacy records | Must not import Phase 0 balance, DTO, normalized transactions, aging, or rent roll |

Additional rules:

- `ledgerEvents` is an event/audit stream, not automatically equivalent to posted `ledgerEntries`;
- provider event receipts and raw webhook/provider payloads are not diagnostic source input;
- `paymentIntents` and reconciliation/allocation records provide linkage/state and cannot create money effects without an eligible posted source;
- allocation reversals and ledger payment reversals must remain append-safe evidence, not overwritten history;
- write-offs and adjustments require explicit supported type/direction mappings;
- legacy records missing landlord/lease/property scope fail instead of being attached heuristically;
- every candidate collection must be classified as authoritative transaction, corroborating evidence, derived obligation, or independent comparison input.

## 8. Source read authorization model

There are two independent authorization layers:

### Human/job authorization

- named internal operator with dedicated diagnostic permission and time-bound elevation;
- second-reviewed exact landlord/lease manifest;
- approved environment, revision, as-of date, reason, expiry, and maximum count;
- no landlord/admin impersonation and no client-provided role.

### Provider read authorization

- dedicated machine identity with read-only access to the minimum approved collections;
- no create/update/delete permission and no provider/payment execution permission;
- provider receives only an already validated exact scope object;
- application-level scope checks are mandatory even when infrastructure IAM permits broader collection reads;
- no wildcard landlord or query-generated lease discovery;
- deny before reads when manifest, operator, version, or scope is invalid;
- deny cross-landlord records rather than silently filter them;
- do not pass operator credentials or identity into financial records.

Phase 0N should model authorization as an injected `authorizedScope` contract for tests. It must not implement IAM, runtime auth, or environment loading.

## 9. Source snapshot construction rules

Phase 0N should define a provider-core pipeline:

1. validate provider, source-manifest, mapping-policy, and query-plan versions;
2. validate exact authorized landlord/lease/context/as-of scope;
3. consume a direct lease read receipt;
4. prove lease ownership and canonical property reference;
5. consume direct property, optional unit, tenant, and responsibility receipts;
6. prove exact mappings;
7. consume one receipt for every financial source family;
8. validate each receipt’s query scope, success state, pagination, bounds, read time, and schema version;
9. reject cross-scope records and unsafe fields before normalization;
10. project raw records into explicit Phase 0E source contracts;
11. construct independent legacy effects through a separate injected projector/contract;
12. verify compatible read/as-of boundaries;
13. emit `ReceivablesSourceSnapshotAdapterInput` only when all gates pass;
14. otherwise emit non-financial typed readiness failures with no partial snapshot.

The core must not call Phase 0I or Phase 0K; those remain separate layers. It must not expose raw receipts or records in its safe result.

### Read-boundary requirement

The audit does not assume that independent Firestore queries automatically share one transaction/read timestamp. A later adapter must either prove a supported consistent-read mechanism for all required reads or define a conservative version/high-watermark policy that detects intervening updates and fails closed. Merely recording wall-clock start/end is insufficient.

## 10. Demo/in-memory fallback exclusion rules

The in-memory `leaseService` and demo/seed fixtures are categorically ineligible for ownership proof or source completeness.

- never import `leaseService` into the provider core or production adapter;
- never fall back from missing Firestore data to in-memory leases;
- never merge demo and authoritative records;
- never treat seeded display data as mapping proof;
- never use admin demo routes or preview fixtures as source readers;
- never query multiple alias fields and accept the first result;
- never use a route-local catch-to-empty helper;
- never infer landlord scope from the authenticated user when the exact manifest differs;
- preserve Phase 0I rejection of `proofSource: in_memory_fallback`;
- add forbidden-import and sentinel tests proving fallback code is unreachable.

Missing authoritative data yields an unavailable/incomplete result, not a demo substitute.

## 11. Unsafe field exclusion rules

Projection must be allowlist-first per source family. Do not fetch broad objects and delete a few known fields only at the end.

Always exclude from Phase 0I input and provider output:

- bank account, routing, transit, institution, IBAN, SWIFT, mandate, and payment-method details;
- provider/processor names, account/customer/session/payment/event IDs, raw statuses, payloads, metadata, and receipts unless a safe internal linkage is explicitly required and renamed under Phase 0E contracts;
- credentials, secrets, tokens, API keys, authorization headers, webhook signatures, and encrypted blobs;
- Firestore document references, collection/document paths, storage paths/URLs, bucket names, and attachment references;
- admin/support scope keys, impersonation data, reviewer notes, internal flags, and staff assignments;
- tenant email, phone, government ID, screening data, documents, messages, and unrelated PII;
- created-by/reversed-by email, notes, free-form reasons, raw exception text, and audit payloads;
- raw canonical event/provider payloads.

Allowed projections should include only IDs needed for internal Phase 0E linking, supported financial/date/type fields, mapping state, safe display labels required by Phase 0I, and explicit source/version attributes. IDs remain internal inputs and never appear in non-financial job output/logs.

Unsafe-key and unsafe-value scanning remains a defense-in-depth check after allowlist projection, not the primary projection method.

## 12. Manifest and version governance

Required versions:

- `providerVersion`;
- `sourceManifestVersion` listing required families and authority class;
- `mappingPolicyVersion` for ownership/party/legacy-field precedence;
- `queryPlanVersion` for collection, filters, ordering, pagination, and bounds;
- `projectionVersion` for per-family allowlists;
- Phase 0E normalizer version expectation;
- Phase 0I snapshot version expectation;
- Phase 0G comparator version expectation;
- Phase 0K runner version expectation;
- source schema/version evidence for each receipt where available.

Governance rules:

- unknown, missing, mixed, or incompatible versions fail closed;
- versions are immutable constants, not silently changed environment defaults;
- any collection/filter/order/projection/mapping change increments the relevant version and fixtures;
- the exact diagnostic manifest pins environment, revision, versions, landlord/lease/context, as-of date, and expiry;
- no wildcard version compatibility;
- provider output records versions but safe external output does not expose scope IDs or source details;
- a successful older fixture does not authorize a new query plan.

## 13. Source completeness rules

Each read port must return records plus a typed receipt containing at minimum:

- source family and query-plan version;
- exact landlord/lease/property scope used;
- state: `complete`, `empty_confirmed`, `unavailable`, `ambiguous`, or `truncated`;
- query success/authorization result without raw error text;
- page count, bounded record count, and exhaustion proof;
- deterministic ordering/cursor completion;
- read timestamp/version/high-watermark evidence;
- as-of cutoff applied;
- schema/projection version;
- whether any record was rejected for cross-scope or unsafe content.

Rules:

- `empty_confirmed` requires a successful, exhausted, exact-scope query;
- error, missing index, permission denial, timeout, cancellation, cap, or partial page is never empty;
- hard limits such as `limit(1000)` require explicit proof that no additional page exists;
- post-read landlord filtering cannot prove query completeness;
- every required family must have a receipt, even when empty;
- record counts are internal validation data and not lease-level output/log fields;
- intervening update/version mismatch invalidates the snapshot;
- Phase 0I receives only states proven by receipts.

## 14. Source conflict and ambiguity handling

Fail closed for:

- conflicting lease owner fields;
- multiple lease documents/aliases for one canonical ID;
- lease/property landlord disagreement;
- unit/property or unit/landlord disagreement;
- tenant/primary-tenant/tenant-array disagreement;
- evidence with mismatched landlord, lease, property, unit, tenant, or responsibility scope;
- duplicate source IDs with different financial effects;
- conflicting links among ledger, payment, intent, reconciliation, and allocation records;
- unsupported transaction/status/currency/frequency types;
- an allocation or reversal whose target cannot be resolved uniquely;
- records that cross the as-of boundary inconsistently;
- independent legacy effects that cannot be derived without Phase 0 projections;
- mixed source versions or incomplete pagination.

Do not choose the newest, first, largest, or most convenient record. Do not repair, merge, deduplicate, or filter conflicts outside the explicit Phase 0E precedence/linkage rules. Return bounded reason codes and no partial comparator input.

## 15. Logging and observability boundaries

The provider core should not log. It returns typed internal failures to its caller.

A future adapter may emit only:

- provider/query-plan/projection versions;
- safe source-family category;
- bounded success/incomplete/ambiguous/unsafe/error category;
- duration and record-count bands;
- cancellation/timeout counters;
- random correlation ID unrelated to business identifiers.

Do not log or trace landlord, lease, property, unit, tenant, responsibility, payment, transaction, intent, reconciliation, allocation, provider, or bank identifiers; financial values; display labels; query parameters; collection/document paths; manifest contents; records; cursors; raw errors; or stack traces.

Metrics must use bounded labels. Capture-and-scan tests must cover success, every typed failure, thrown dependency errors, pagination, unsafe data, and output projection failure. If safe projection fails, suppress output rather than serialize raw data.

## 16. Retention and audit-trail considerations

Phase 0N must have no persistence.

- do not store receipts, snapshots, raw records, projected records, Phase 0I inputs, independent effects, errors, or outputs;
- do not write Firestore, object storage, analytics, tickets, email, or messages;
- do not create accounting/canonical audit events for read-only diagnostics;
- injected fixtures remain test data only;
- ordinary test/build output must not contain real IDs or financial data;
- future adapter telemetry follows the separately approved short operational retention policy and the logging boundary;
- authorization/change evidence belongs in the controlled governance system, not the provider.

Durable non-financial run-result retention remains subject to a later audit. The source provider must never become a shadow ledger or evidence archive.

## 17. Test requirements before implementation

### Provider core contracts

- exact authorized landlord/lease/context/as-of validation;
- missing, malformed, wildcard, expired, and version-mismatched scope denial;
- direct canonical lease only; no alias query/fallback;
- canonical owner success plus absent/conflicting/legacy-only owner failures;
- property/unit/tenant/responsibility success, missing, ambiguous, and cross-scope cases;
- deterministic mapping-policy precedence and unsupported legacy schema failure;
- input immutability and deterministic typed results.

### Source families and completeness

- every required family present with complete or confirmed-empty receipt;
- missing family, failed query, permission denial, timeout, cancellation, truncation, cap, and pagination gap fail;
- exact ordering/cursor exhaustion and bounded counts;
- same read/as-of/version compatibility;
- cross-scope record rejection;
- overlapping ledger/payment/rent-payment evidence preserved for Phase 0E linkage;
- intents/reconciliation/allocations cannot invent transactions;
- reversal/write-off/allocation target failures;
- independent legacy effects import no Phase 0 balance/DTO/aging/rent-roll output;
- unsupported currency/frequency/status/type failure.

### Privacy, authorization, and dependency boundary

- whitelist projection for each source family;
- bank/provider/credential/token/path/admin/free-text/PII fields excluded;
- unsafe nested keys and values rejected;
- no `db`, Firebase, Firestore SDK, route, job, scheduler, UI, provider, payment mutation, environment, timer, or persistence import in Phase 0N core;
- no in-memory `leaseService` or demo fixture import outside tests;
- read ports are not called after outer gate failure;
- logs/stdout/stderr remain empty or pass forbidden-data scans;
- output never exposes raw receipts or records;
- all Phase 0 through Phase 0K tests and backend build remain green.

## 18. Non-goals

- No production Firestore adapter or runtime read in Phase 0M/0N core.
- No Firestore writes, migrations, schema rewrites, or index/infrastructure changes.
- No diagnostic job, scheduler, queue, command, route, worker, UI, or runtime registration.
- No Phase 0K invocation outside tests.
- No financial totals, read routes, exports, statements, rent roll, aging, schedules, or tenant balances.
- No mutation of leases, ledger, payments, intents, reconciliation, allocations, obligations, tenants, or decisions.
- No Rotessa, PAD, provider integration, bank data, payment method, debit, settlement, payout, or webhook behavior.
- No money movement, custody, pooled funds, trust accounts, settlement float, or landlord payout liabilities.
- No treatment of tenant rent as RentChain revenue.
- No change to existing ledger or RC1 demo behavior.

## 19. Recommended next implementation PR, if safe

The audit approves this narrowly bounded branch:

`backend/phase-0n-receivables-authoritative-source-provider-core-v1`

Phase 0N should add only:

- versioned provider-core input/output and read-receipt types under `rentchain-api/src/lib/accounting`;
- an injected, pure/unmounted provider-core assembler;
- explicit canonical ownership and mapping validators;
- required source-family manifest/completeness validators;
- whitelist projection functions from injected raw records to Phase 0E/0I contracts;
- compatible read/as-of/version checks;
- deterministic synthetic fixtures and focused tests;
- barrel exports if consistent with accounting conventions.

Phase 0N must not import `db`, Firebase, the Firestore SDK, route/service runtime helpers, the in-memory lease service, provider/payment adapters, environment configuration, jobs, schedulers, or persistence. It must not register or invoke Phase 0K at runtime.

After Phase 0N, conduct another docs-only audit of the concrete Firestore read adapter, exact canonical ownership schema, queries, indexes, IAM, consistent-read mechanism, and zero-write deployment boundary. A runnable job remains deferred.

## 20. Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| Legacy owner alias accepted opportunistically | Cross-landlord exposure | One versioned canonical owner policy; conflicts deny |
| In-memory lease fallback used | Demo data becomes financial authority | Forbidden import and direct-document-only contract |
| Query error treated as empty | False parity | Typed completeness receipts; no catch-to-empty |
| Capped query treated as complete | Omitted evidence | Pagination/exhaustion proof |
| Post-read landlord filtering | Broad unauthorized read | Exact-scope query plus per-record validation |
| Mixed read times | Internally inconsistent snapshot | Proven consistent read or version/high-watermark failure |
| Payment sources double counted | Incorrect balance | Preserve linkage; Phase 0E precedence/dedupe |
| Intent/reconciliation invents money effect | False receivable/payment | Corroborating-only evidence roles |
| Independent parity is circular | Comparison always passes | Separate raw legacy-effect projector |
| Provider/bank fields leak | Privacy/security exposure | Per-family whitelist projection and unsafe scan |
| Raw errors/paths reach logs | Internal topology disclosure | Typed failures; provider core does not log |
| Provider core starts reading Firestore | Runtime boundary bypass | Injected read receipts only; forbidden imports |
| Core output becomes a financial endpoint | Premature product exposure | Unmounted internal snapshot input only |
| Read provider gains write permission | Accounting mutation risk | Separate read-only identity and zero-write tests |
| Tenant rent becomes platform revenue | Accounting/legal misstatement | Explicit landlord-revenue boundary |

## Decision

The candidate stores can support a future authoritative provider only through a new, explicit authority and completeness contract; existing route/service readers are not safe to reuse directly. Proceed with Phase 0N as a pure, unmounted provider core over injected read receipts. Defer the concrete Firestore adapter, runtime reads, and diagnostic job until canonical ownership, query completeness, consistent-read behavior, IAM, indexes, logging, and zero-write controls are separately audited and proven.
