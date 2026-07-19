# Phase 0O Receivables Firestore Source Adapter Readiness v1

Status: readiness audit only; no Firestore adapter, runtime read, job, route, persistence, or deployment change is authorized

## 1. Executive summary

A concrete Firestore source adapter is **not yet safe to implement**.

Phase 0N now defines the correct injected receipt boundary: twelve required source classes, exact scope and read-boundary checks, canonical ownership rules, completeness/cap/filter/alias/catch-to-empty gates, unsafe-field rejection, and Phase 0E normalization preflight. A Firestore adapter must prove those receipt claims from persisted data rather than merely populate the fields with optimistic values.

The current repository does not yet provide that proof:

1. persisted lease/property ownership uses multiple fields in operational code, while the checked-in lease model does not establish one canonical `landlordId` contract;
2. checked-in Firestore indexes do not document the exact landlord-plus-lease query plans required for every financial collection;
3. several helpers query by lease and filter landlord afterward, catch query failures as empty, or use fixed limits without exhaustion proof;
4. reconciliation records often link through `subjectId`, `paymentIntentId`, or payment IDs rather than carrying one exact canonical landlord/lease/property scope;
5. obligations are derived across lease terms and payment evidence rather than stored in one authoritative collection;
6. no proven consistent-read mechanism or high-watermark protocol spans all required collections;
7. Admin SDK reads bypass client Firestore rules, so a dedicated read-only service identity and application scope controls require separate design.

The proposed `backend/phase-0p-receivables-firestore-source-adapter-v1` must remain deferred. The next safe branch is a docs-only persisted-schema and exact-query-plan audit. That audit must resolve canonical ownership fields, per-collection scope keys, compound indexes, pagination, consistent reads, reconciliation linkage, obligation derivation, and least-privilege IAM before code is approved.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, bank data, payment execution, money movement, custody, pooled funds, settlement float, and payout liabilities remain out of scope.

## 2. Current accounting foundation recap

The safety sequence now includes:

- **Phase 0 / PR #1396:** deterministic receivables primitives;
- **Phase 0B / PR #1397:** accounting read-model surface separation;
- **Phase 0C / PR #1398:** landlord-safe DTO assembly and legacy equivalence;
- **Phase 0D / PR #1399:** route and completeness gates;
- **Phase 0E / PR #1400:** legacy source precedence, linkage, deduplication, and ambiguity failure;
- **Phase 0F / PR #1401:** shadow-route readiness boundaries;
- **Phase 0G / PR #1402:** default-off non-financial comparator;
- **Phase 0H / PR #1403:** comparator adoption audit;
- **Phase 0I / PR #1404:** pure source-snapshot adapter;
- **Phase 0J / PR #1405:** diagnostic job readiness plan;
- **Phase 0K / PR #1406:** pure diagnostic runner core;
- **Phase 0L / PR #1407:** runnable-job deferral;
- **Phase 0M / PR #1408:** authoritative source-provider design;
- **Phase 0N / PR #1409:** pure provider core over injected read receipts.

All new implementation remains unmounted under `rentchain-api/src/lib/accounting`. There is no receivables Firestore adapter, job, route, UI, or landlord financial read exposure.

## 3. What Phase 0N provider core enables

Phase 0N provides:

- versioned provider and source-manifest contracts;
- twelve explicit read-receipt classes;
- one exact landlord/lease/context/as-of target;
- source-class and source-version checks;
- one compatible injected read-boundary version;
- authoritative/suitable-for-financial-diagnostics flags;
- capped-query completeness proof;
- rejection of alias ownership, post-read filtering, and catch-to-empty;
- complete/confirmed-empty state consistency;
- exact landlord/lease receipt scope validation;
- canonical direct lease/property ownership checks;
- property/unit/tenant/responsibility mapping checks;
- display-label checks without ID fallback;
- bank/provider/admin/path/credential unsafe-field rejection;
- source-kind enforcement and Phase 0E normalization preflight;
- safe Phase 0I input only when every gate passes;
- a deterministic non-financial validation envelope.

These guarantees define what the adapter must prove. They do not authorize the adapter to mark a query authoritative merely because Firestore returned successfully.

## 4. Why Firestore adapter readiness needs separate review

A Firestore adapter introduces risks that pure receipt validation cannot solve:

- production data authority and service-account access;
- persisted schema drift and legacy documents;
- query/index feasibility;
- pagination and result limits;
- read-time consistency across collections;
- permission-denied, missing-index, timeout, cancellation, and retry behavior;
- raw PII/provider/path fields before projection;
- record linkage across overlapping financial sources;
- cost and denial-of-service bounds;
- runtime logging and error serialization;
- accidental write-capable dependency injection.

The adapter is the first Phase 0 component that would touch production stores. It requires its own schema, IAM, query, privacy, and operational proof rather than inheriting readiness from Phase 0N tests.

## 5. Candidate authoritative Firestore sources

| Phase 0N receipt | Candidate persisted source | Current readiness |
| --- | --- | --- |
| Ownership | `leases/{leaseId}` plus `properties/{propertyId}` | Blocked on canonical ownership-field governance |
| Lease | `leases/{leaseId}` | Direct read is viable only for schema-compliant documents |
| Property | `properties/{propertyId}` | Direct read; canonical owner field unresolved across operational patterns |
| Unit | `units/{unitId}` | Direct read with exact property + landlord validation |
| Tenant | `tenants/{tenantId}` | Direct read supports existence/display; lease linkage must remain authoritative |
| Ledger | `ledgerEntries` | Candidate primary posted evidence; exact landlord + lease query/index required |
| Payment | `payments` and `rentPayments` | Both required until authority/precedence is resolved; overlap preserved for Phase 0E |
| Payment intent | `paymentIntents` | Exact landlord + lease query required; intent cannot create a transaction |
| Reconciliation | `paymentReconciliationRecords` | Not ready: current records may lack canonical landlord/lease scope |
| Obligation | lease terms plus supported intent/ledger evidence | Not ready as a standalone query receipt; versioned derivation required |
| Allocation | `leaseCreditAllocationRecords` | Candidate, but existing reader queries lease then filters landlord |
| Legacy effects | independent projection from eligible raw sources | Requires separate query/mapping plan independent from Phase 0 calculations |

`ledgerEvents`/event streams and raw provider webhook receipts are not substitutes for posted `ledgerEntries`. Demo/seed collections and the in-memory lease service are never authoritative.

## 6. Ownership proof requirements

The adapter may create `proofSource: canonical_direct` only when:

1. the exact manifest lease ID is read as `leases/{leaseId}`;
2. the document exists and is schema-supported;
3. one approved canonical lease `landlordId` equals the manifest landlord exactly;
4. legacy owner fields are absent or provably identical under a versioned migration policy;
5. conflicting `landlordId`, `ownerId`, `ownerUserId`, or `userId` values fail;
6. the lease carries one canonical property ID;
7. `properties/{propertyId}` exists and its approved canonical landlord field matches;
8. the lease/property reads share the approved read boundary;
9. no query alias, first-match selection, post-read ownership filter, or in-memory fallback is used;
10. the adapter projects only required fields into the Phase 0N ownership receipt.

The checked-in `LeaseRecord` type currently omits landlord ownership even though runtime code reads it. A persisted-schema decision is required before implementation. The adapter must not encode the schema decision implicitly.

## 7. Lease/property/unit/tenant mapping requirements

### Lease

- direct canonical document only;
- exact document ID equals target lease ID;
- supported schema/source version;
- valid property, tenant, responsibility, dates, rent, due day, currency, and frequency;
- no alias lookup by `id`/`leaseId` if direct read is absent.

### Property

- direct document ID equals lease property ID;
- canonical landlord matches lease/manifest;
- manager/staff access may authorize the read but does not become accounting ownership;
- conflicting owner fields fail.

### Unit

- direct document ID equals canonical lease unit ID;
- exact property and landlord match;
- no unit-number/display lookup;
- confirmed no-unit is allowed only when lease schema explicitly declares no unit.

### Tenant/responsibility

- tenant ID comes from a versioned lease party precedence policy;
- conflicting `tenantId`, `primaryTenantId`, and `tenantIds` fail;
- no mapping by email, name, invite, or current session;
- direct tenant read validates existence and safe display label;
- responsibility identity must be deterministic; absent responsibility schema fails rather than inventing an ID;
- tenant document pointers may corroborate but cannot override the lease.

## 8. Financial evidence source requirements

### Ledger

Query `ledgerEntries` by exact `landlordId == target` and `leaseId == target`, with deterministic ordering and pagination. Include posted charges, eligible payments, adjustments, write-offs, and reversals under explicit type mappings.

### Payments

Query both `payments` and `rentPayments` by exact landlord + lease until one source is formally retired. Project both into `payment_record` evidence and preserve canonical event/link IDs for Phase 0E. Never deduplicate in the adapter by amount/date heuristics.

### Intents

Query `paymentIntents` by exact landlord + lease. Project as corroborating evidence only unless Phase 0E explicitly supports a safe preview role. Exclude provider/session/payment identifiers and metadata.

### Reconciliation

Current reconciliation records commonly link through subject/payment IDs. A safe adapter needs canonical landlord, lease, and property fields or an approved join plan that starts from already exact-scope payment/intent IDs and proves exhaustive linkage. Broad `subjectId` queries plus post-read ownership filtering are insufficient.

### Obligations

There is no single established obligation collection. A versioned derivation must specify whether obligation evidence comes from canonical lease schedule terms, eligible payment intents, or another persisted source. Derived obligations remain preview evidence and cannot invent posted transactions.

### Allocations

Query `leaseCreditAllocationRecords` by exact landlord + lease. Preserve active/reversed append-safe records and target links. The current lease-only query followed by landlord filtering cannot be reused.

### Independent legacy effects

Build from raw eligible sources using a separate mapping path. Do not call Phase 0 balance, DTO, normalization result, aging, rent roll, or schedule output to construct the parity side.

## 9. Query completeness requirements

Every collection query must produce a receipt only after proving:

- exact target fields were included in the Firestore query, not only checked afterward;
- query executed successfully with the expected index;
- every page was read in deterministic order;
- final page/exhaustion was observed;
- no page was skipped, repeated, timed out, cancelled, or retried into a mixed boundary;
- every record matched landlord/lease/property scope;
- as-of cutoff and supported source version were applied;
- consistent read/high-watermark policy passed;
- unsafe projection succeeded for every record;
- no unsupported schema/type/status was silently discarded.

`empty_confirmed` requires a successful exact-scope exhausted query returning zero. Permission denial, missing index, unavailable service, timeout, cancellation, malformed data, unsupported schema, or projection failure is `unavailable`/`ambiguous`, never empty.

## 10. Capped-query and pagination rules

- no fixed `limit(N)` may be declared complete without reading the `N+1` sentinel or continuing pages to exhaustion;
- use stable ordering ending in document ID as a tiebreaker;
- use an immutable cursor from the last accepted document;
- pin page size and maximum pages/records in a versioned query plan;
- if the safety maximum is reached before exhaustion, receipt state is `partial`/`truncated` and Phase 0N rejects it;
- do not truncate old records based only on as-of date when reversals/links require history;
- record internal page/count proof in the receipt builder but do not log lease-level counts;
- retry only if the consistent-read mechanism guarantees the same boundary; otherwise restart the entire snapshot or fail;
- duplicate/missing cursor detection fails closed.

The checked-in index file does not currently document landlord + lease + deterministic ordering indexes for all required collections. Required indexes must be enumerated and reviewed before adapter implementation; Phase 0O does not authorize index changes.

## 11. Post-read filtering prohibition

The adapter must not query broadly and then filter authority fields in memory.

Prohibited examples already visible in operational helpers include:

- query `rentPayments` by lease, then filter landlord;
- query `paymentIntents` by lease, then filter landlord;
- query allocation records by lease, then filter landlord;
- query `payments` by lease or tenant without exact landlord;
- query reconciliation by generic subject and infer lease later;
- query owner aliases independently and union results.

Per-record validation remains mandatory as an integrity check, but it does not compensate for a broad query. A receipt with any authority-relevant post-read filtering must set `postReadFiltered: true` and will be rejected by Phase 0N.

## 12. Catch-to-empty prohibition

No required read may use `.catch(() => null)`, `.catch(() => ({ docs: [] }))`, or equivalent fallback.

The adapter must distinguish:

- confirmed missing direct document;
- confirmed empty exact query;
- permission denied;
- missing/disabled index;
- deadline/timeout;
- cancellation;
- unavailable service;
- malformed response;
- pagination failure;
- unexpected exception.

Only the first two may map to missing/empty states, and identity documents required for ownership still fail. All other outcomes create typed non-financial errors, `catchToEmpty: false`, and no safe Phase 0N snapshot.

## 13. Alias and fallback ownership restrictions

- canonical direct lease ID only;
- canonical `landlordId` policy only after schema approval;
- no `ownerId`, `ownerUserId`, `userId`, manager ID, email, tenant pointer, or route-user fallback;
- no `where("id")`/`where("leaseId")` fallback after missing direct document;
- no in-memory `leaseService` fallback;
- no demo/admin-demo/seed fixture fallback;
- no public-readable property as ownership proof;
- no service-account authority as landlord ownership;
- no first matching alias when fields conflict.

Legacy documents that require aliases are ineligible for Phase 0 diagnostics until a separate canonicalization/migration policy is approved. Phase 0O authorizes no migration.

## 14. Unsafe field exclusion rules

Use per-collection allowlist projection immediately after each read. Never pass raw snapshots into Phase 0N.

Exclude:

- bank account, routing, transit, institution, mandate, payment-method, IBAN, and SWIFT data;
- provider/processor account, customer, session, payment, event, receipt, raw status, and metadata fields;
- credentials, secrets, tokens, API keys, auth headers, webhook signatures, and encrypted blobs;
- Firestore references/paths, collection/document names in payloads, storage paths/URLs, buckets, and attachments;
- admin/support scope, impersonation, staff assignments, notes, free-form reasons, and reviewer fields;
- tenant email, phone, screening, documents, messages, government IDs, and unrelated PII;
- raw audit/provider/canonical event payloads and stack traces.

Allocation projection must exclude creator/reverser emails and notes. Reconciliation projection must exclude provider identity and raw status while preserving only approved internal links/state. Unsafe scanning remains defense in depth after whitelist projection.

## 15. Firestore read authorization model

Firestore client rules shown in the repository protect client SDK access but do not constrain trusted Admin SDK credentials. The future adapter therefore requires:

- a dedicated service account/workload identity, not the general application identity where feasible;
- read-only IAM/data access to the minimum approved collections;
- no create/update/delete, provider, secret, storage, or payment-execution access;
- exact manifest validated before adapter calls;
- application-level landlord/lease scope on every query;
- environment and revision binding;
- no broad landlord/portfolio discovery;
- no operator credential passed to Firestore records;
- emulator and policy tests plus an IAM review before deployment;
- proof that transitive dependencies cannot write.

The final collection/IAM design remains unresolved. Therefore production adapter implementation is deferred.

## 16. Adapter output/read-receipt contract

The adapter should eventually return only Phase 0N inputs:

- twelve `ReceivablesAuthoritativeReadReceipt` objects;
- exact source class and version;
- one compatible read-boundary version;
- complete/confirmed-empty state;
- authoritative/suitable flags derived from query-plan success;
- cap/completeness, post-filter, alias, and catch-to-empty flags;
- exact internal scope;
- allowlisted projected records;
- bounded typed reason codes.

The adapter must not call Phase 0N, Phase 0I, Phase 0G, or Phase 0K itself. Orchestration remains separate. It must not expose raw snapshots, document references, cursors, query objects, paths, amounts, or identifiers in its safe error/output envelope.

## 17. Failure and fail-closed behavior

| Failure | Adapter behavior |
| --- | --- |
| Unauthorized/invalid manifest | No Firestore call |
| Lease/property ownership absent or conflicting | Stop; no financial queries |
| Mapping missing/ambiguous | Stop; no receipt set |
| Missing index/permission/timeout | `unavailable`; never empty |
| Pagination cap/gap | `partial`; no completeness proof |
| Mixed read boundary | invalidate all receipts |
| Cross-scope record | ambiguity/integrity failure; do not filter |
| Unsupported schema/type/currency/frequency | fail receipt |
| Unsafe field/projection failure | unsafe; suppress raw record |
| Reconciliation/obligation linkage unresolved | incomplete/ambiguous |
| Independent legacy projection unavailable | no safe snapshot |
| Unexpected error | fixed non-financial category; no raw error |

No failure may write, retry automatically across a changed boundary, mutate accounting/payment state, call a provider, repair records, or continue with partial evidence.

## 18. Test requirements before implementation

### Schema and ownership fixtures

- canonical direct lease/property success;
- missing direct document;
- legacy-only owner field;
- conflicting owner aliases;
- cross-landlord property/unit;
- tenant party conflicts and missing responsibility;
- no-unit explicit versus missing-unit failure;
- display labels missing or equal to internal IDs;
- every supported persisted schema version.

### Query and completeness

- exact landlord + lease filters for every financial collection;
- query-plan/index contract fixtures;
- successful empty versus permission, missing-index, timeout, cancellation, unavailable, and malformed errors;
- multiple pages, stable cursor, duplicate cursor, skipped page, final-page exhaustion;
- `N+1`, maximum-page, maximum-record, and truncation behavior;
- consistent read boundary or high-watermark mismatch;
- cross-scope record causes failure, not filtering;
- no route-local catch-to-empty helper reuse.

### Evidence and privacy

- overlapping `payments`/`rentPayments`/ledger linkage;
- intent and reconciliation cannot create transactions;
- reconciliation join completeness;
- obligation derivation policy;
- allocation/reversal/write-off linkage;
- independent legacy path is not circular;
- per-collection allowlist projection;
- bank/provider/admin/path/storage/credential/PII fields excluded;
- raw errors/snapshots/cursors cannot be logged or returned.

### Dependency and integration boundary

- read-only injected Firestore interface with no write methods;
- no route/job/scheduler/UI/provider/payment mutation imports;
- adapter remains unmounted;
- adapter output feeds Phase 0N in emulator/in-memory tests only;
- all Phase 0 through Phase 0N accounting tests and backend build pass;
- zero Firestore writes and zero runtime invocation.

## 19. Manual/operator QA requirements if implemented

If a later adapter is approved, manual QA must occur against an emulator or isolated non-production project first.

- verify exact candidate commit, environment, service identity, and read-only permissions;
- verify all required indexes are deployed and match the versioned query plan;
- seed canonical, empty, multi-page, conflict, cross-landlord, legacy, and unsafe fixtures;
- confirm direct ownership reads precede financial queries;
- confirm exact filters and deterministic pagination using query instrumentation;
- induce permission, missing-index, timeout, cancellation, cap, and projection errors;
- confirm none become empty receipts;
- confirm no post-read authority filtering or fallback path executes;
- confirm Phase 0N accepts only the canonical complete fixture;
- scan output/logs/traces for IDs, values, paths, provider/bank/admin data, and raw errors;
- confirm zero writes, provider calls, job/route registration, and RC1 changes;
- remove temporary data/access and keep adapter unmounted;
- require separate approval before any production read.

## 20. Non-goals

- No Firestore adapter implementation in Phase 0O.
- No runtime read, Firestore write, schema migration, index change, IAM change, or deployment change.
- No diagnostic job, scheduler, command, queue, worker, route, or UI.
- No Phase 0N/0K runtime invocation.
- No landlord/admin financial read, balance, schedule, aging, rent roll, or statement exposure.
- No ledger/payment/allocation/reconciliation/lease/tenant mutation.
- No Rotessa, PAD, provider integration, bank data, payment method, debit, settlement, payout, or webhook behavior.
- No money movement, custody, pooled funds, trust accounts, settlement float, or payout liabilities.
- No treatment of tenant rent as RentChain revenue.
- No RC1 behavior change.

## 21. Recommended next implementation PR, if safe

`backend/phase-0p-receivables-firestore-source-adapter-v1` is **not approved**.

The next branch should be:

`audit/phase-0p-receivables-firestore-schema-query-plan-v1`

That docs-only audit should produce a collection-by-collection matrix containing:

- canonical document schema and owner/scope fields;
- supported legacy versions and explicit ineligibility rules;
- exact query filters and deterministic order;
- required compound indexes;
- page size, cursor, maximum pages/records, and exhaustion proof;
- read-boundary/transaction/high-watermark mechanism;
- per-collection allowlist projection;
- reconciliation join and obligation derivation plan;
- independent legacy-effect query plan;
- dedicated service identity/IAM permissions;
- emulator fixture and failure matrix;
- cost/query bounds.

Only after that plan is approved and required schema/index/IAM prerequisites are separately authorized should a backend-only, unmounted, read-only Phase 0P adapter be implemented.

## 22. Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| Owner alias treated as canonical | Cross-landlord exposure | One approved persisted ownership field/version |
| Client rules assumed to protect Admin SDK | Broad backend read | Dedicated least-privilege service identity |
| Lease-only query plus landlord filter | Unproven scope/completeness | Exact compound query; cross-scope record fails |
| Catch-to-empty helper reused | False zero/equivalence | Typed error outcomes; never empty on error |
| Fixed limit treated as complete | Omitted evidence | Deterministic pagination/exhaustion proof |
| Required compound index absent | Runtime query failure | Versioned index plan before code |
| Mixed collection read times | Inconsistent snapshot | Proven consistent boundary/high-watermark |
| Payment sources overlap | Double count | Preserve links; Phase 0E normalization |
| Reconciliation join incomplete | Missing evidence | Canonical scope fields or exhaustive approved join |
| Obligation policy implicit | Invented receivable | Versioned derivation contract |
| Independent parity circular | Meaningless comparison | Separate raw legacy-effect path |
| Raw snapshot reaches Phase 0N | Bank/provider/PII exposure | Per-collection whitelist projection first |
| Adapter identity can write | Accounting mutation | Read-only interface/IAM and zero-write tests |
| Adapter becomes a route/job dependency | Premature runtime behavior | Unmounted until separate adoption audit |
| Tenant rent treated as platform revenue | Accounting/legal misstatement | Explicit landlord-revenue boundary |

## Decision

Phase 0N is ready to consume authoritative Firestore receipts, but the persisted schemas and query plans cannot yet prove those receipts safely. Defer the concrete adapter. First approve a collection-by-collection schema, exact-query, index, pagination, read-boundary, reconciliation, obligation, projection, and IAM plan. Keep all Firestore reads, jobs, routes, UI, and financial exposure unimplemented.
