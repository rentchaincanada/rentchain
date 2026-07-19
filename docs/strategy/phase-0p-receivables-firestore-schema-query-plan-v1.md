# Phase 0P Receivables Firestore Schema and Exact-Query Plan v1

Status: schema/query planning only; no Firestore adapter, index, migration, runtime read, job, route, persistence, or deployment change is authorized

## 1. Executive summary

A concrete Phase 0Q Firestore source adapter is **not yet safe to implement**.

The repository contains plausible persisted sources for most Phase 0N receipt classes, but the current data contracts and checked-in indexes do not prove the exact, complete, consistently bounded reads required for financial diagnostics. The principal gaps are:

- `leases` ownership is used operationally as `landlordId`, but the checked-in `LeaseRecord` contract omits that field and runtime code still recognizes multiple ownership aliases;
- required compound indexes for exact `landlordId + leaseId + deterministic order` queries are not present for the financial evidence collections;
- reconciliation evidence does not consistently carry canonical landlord, lease, property, and linked-source scope;
- obligations are derived from lease terms and overlapping evidence rather than stored as one authoritative collection;
- no cross-collection read-boundary or high-watermark contract proves a consistent snapshot;
- existing readers sometimes post-filter authority, catch failures as empty, or cap results without exhaustion proof; and
- a dedicated read-only execution identity and collection-level access policy are not yet defined or tested.

This plan defines the target persisted schema, exact query shapes, indexes, pagination, completeness, consistency, redaction, and manifest rules required before an adapter may be approved. It does not declare existing documents compliant and does not authorize schema or index changes.

The next safe branch is `audit/phase-0q-receivables-firestore-schema-migration-index-iam-rollout-v1`, a docs-only rollout plan. The implementation name `backend/phase-0q-receivables-firestore-source-adapter-v1` remains deferred until that plan is approved and its separately authorized prerequisites are delivered and verified.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, provider execution, tenant bank data, money movement, custody, pooled funds, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

The accounting safety sequence is:

- Phase 0: deterministic receivables/subledger primitives;
- Phase 0B: accounting read-model surface separation;
- Phase 0C: landlord-safe lease receivables DTO assembly;
- Phase 0D: route and completeness gates;
- Phase 0E: legacy-source normalization, precedence, and deduplication;
- Phase 0F: shadow-route readiness boundaries;
- Phase 0G: disabled, exact-allowlist, non-financial comparator;
- Phase 0H: comparator adoption audit;
- Phase 0I: source-snapshot adapter;
- Phase 0J: diagnostic-job readiness audit;
- Phase 0K: pure diagnostic runner core;
- Phase 0L: diagnostic-job implementation deferral;
- Phase 0M: authoritative source-provider design;
- Phase 0N: pure provider core over injected read receipts;
- Phase 0O: Firestore adapter readiness audit; and
- Phase 0P: this persisted-schema and exact-query plan.

The implementation remains pure and unmounted under `rentchain-api/src/lib/accounting`. No accounting component introduced by these phases reads Firestore at runtime or exposes a financial route or UI.

## 3. Why schema/query planning must precede adapter implementation

Phase 0N validates claims made by injected read receipts; it cannot establish that Firestore actually produced those claims. A concrete adapter would become the first component in this sequence to touch persisted production sources. Before that boundary is crossed, the repository needs an approved answer for:

- which fields are canonical rather than aliases;
- which documents and collections are authoritative;
- which indexes make exact-scope queries executable;
- how every page and every relevant historical record is proven complete;
- how records read from separate collections belong to one coherent boundary;
- how unsafe fields are excluded before pure accounting code receives data; and
- which workload identity can read only the approved sources without write or provider privileges.

Encoding these decisions implicitly inside adapter code would turn implementation details into an unreviewed schema migration. The schema/query plan therefore precedes adapter implementation.

## 4. Candidate Firestore source inventory

| Phase 0N class | Candidate persisted source | Authority posture | Blocking gap |
| --- | --- | --- | --- |
| Ownership | `leases/{leaseId}` and `properties/{propertyId}` | Direct canonical documents required | Canonical ownership contract/version absent |
| Lease | `leases/{leaseId}` | Candidate authority for lease terms and mappings | Checked-in model and persisted runtime shape diverge |
| Property | `properties/{propertyId}` | Candidate authority for property ownership/label | Owner alias policy unresolved |
| Unit | `units/{unitId}` | Candidate authority for unit/property mapping | Explicit no-unit state and canonical owner version needed |
| Tenant | `tenants/{tenantId}` | Corroborates identity and safe label | Lease party/responsibility remains authoritative mapping |
| Ledger | `ledgerEntries` | Candidate primary posted receivable evidence | Exact index, source version, reversal rules needed |
| Payment | `payments` and `rentPayments` | Overlapping evidence retained for Phase 0E | Source authority and historical linkage vary |
| Payment intent | `paymentIntents` | Preview/corroborating evidence only | Exact index and supported-state mapping needed |
| Reconciliation | `paymentReconciliationRecords` | Corroborating evidence | Canonical scope and exhaustive linkage missing |
| Obligation | Canonical lease terms plus versioned derivation | Derived preview evidence only | No persisted authoritative obligation source |
| Allocation | `leaseCreditAllocationRecords` | Append-safe allocation evidence | Current reader post-filters landlord; index absent |
| Legacy effects | Independent projection from eligible raw sources | Comparator-only parity input | Must remain independent of Phase 0 calculations |

`ledgerEvents`, `ledgerEventsV2`, raw provider/webhook data, demo collections, seed data, and the in-memory lease fallback are not substitutes for posted accounting evidence or ownership proof.

## 5. Canonical landlord ownership schema

### Required lease fields

Every diagnostic-eligible `leases/{leaseId}` document must contain:

- `schemaVersion: "receivables_lease_scope_v1"`;
- `landlordId: string` as the only accounting ownership field;
- `propertyId: string`;
- `unitId: string | null` plus `unitScopeState: "assigned" | "not_applicable"`;
- canonical party fields described below;
- `updatedAt` and an immutable/versioned read-boundary field; and
- no conflicting legacy ownership aliases.

`ownerId`, `ownerUserId`, `userId`, manager IDs, route-user IDs, emails, and current-session identities must not serve as accounting ownership. A diagnostic-eligible document either omits legacy aliases or carries an approved migration marker proving they were checked and match `landlordId`. Conflicting aliases fail closed.

### Required property and unit fields

`properties/{propertyId}` and assigned `units/{unitId}` require:

- supported `schemaVersion`;
- canonical `landlordId` equal to the lease and manifest landlord;
- exact document ID equal to the lease mapping;
- for units, canonical `propertyId` equal to the lease property; and
- safe display fields that do not fall back to document IDs.

Ownership is proven only by direct reads of the target lease and mapped property, with the unit as a mapping integrity check. Public visibility, staff access, service-account access, or property-manager membership is authorization context, not ownership proof.

## 6. Lease/property/unit/tenant mapping schema

The target lease mapping contract is:

```text
leases/{leaseId}
  landlordId
  propertyId
  unitId | null
  unitScopeState
  primaryTenantId
  tenantIds[]
  responsibilityId
  startDate
  endDate | null
  monthlyRentCents
  currency = "cad"
  chargeFrequency = "monthly"
  dueDay
  schemaVersion
  sourceRevision
```

Rules:

- `primaryTenantId` must be present in `tenantIds` and is the Phase 0 responsibility tenant;
- `responsibilityId` must be stable and explicit; it must not be fabricated from a tenant ID at read time;
- multiple tenant candidates without a primary/responsibility decision are ambiguous;
- tenant mapping uses direct `tenants/{primaryTenantId}` only—never email, name, invite, or session lookup;
- tenant documents may corroborate the mapping but cannot override the lease;
- an absent unit is valid only when `unitId` is null and `unitScopeState` is `not_applicable`;
- rent must be integer cents, CAD, monthly, and accompanied by valid date-only lease terms and due day; and
- unsupported schema versions, frequencies, currencies, or inferred proration fail closed.

## 7. Ledger/evidence schema inventory

`ledgerEntries` is the candidate primary posted source. A diagnostic-eligible entry requires:

- `schemaVersion: "receivables_ledger_entry_v1"`;
- canonical `landlordId`, `leaseId`, `propertyId`, and nullable `unitId`;
- optional canonical `tenantId` and required `responsibilityId` where applicable;
- `entryType` from an approved set such as charge, payment, adjustment, write-off, or reversal;
- integer `amountCents`, `currency: "cad"`, and date-only `effectiveDate`;
- stable `canonicalEventKey`;
- link fields such as `paymentDocumentId`, `appliesToSourceId`, or `reversesSourceId` when applicable;
- immutable creation metadata sufficient for ordering; and
- a source revision usable in the read-boundary protocol.

Existing free-form notes, creator identity, method details, references, raw event data, or provider fields are not required accounting inputs and must not enter the receipt projection.

Write-offs and reversals must be append-safe entries. Mutation or deletion of an earlier posted entry cannot be normalized into authoritative history. A reversal must identify the exact prior source, use the same landlord/lease/property/currency scope, and have its own immutable canonical event key.

## 8. Payment/reconciliation/allocation/obligation source inventory

### `payments`

Candidate canonical manual/imported payment evidence. Diagnostic eligibility requires canonical landlord/lease/property scope, integer cents, CAD, effective date, stable source version, and exact linkage to a ledger entry when both exist. Older records missing lease or landlord scope remain ineligible rather than being joined by tenant/date/amount heuristics.

### `rentPayments`

Overlapping execution-lifecycle evidence with useful canonical scope fields. Provider/session/payment fields must be excluded. Only supported internal status, amount, date, and canonical links may be projected. A `rentPayments` record does not independently prove settlement or invent a posted ledger transaction.

### `paymentIntents`

Preview/corroborating evidence only. It requires exact scope, `purpose: "rent"`, supported source/status, dates, amount, currency, and internal linkage. Provider and metadata fields are excluded. Intent state cannot create a posted payment.

### `paymentReconciliationRecords`

The target schema requires canonical `landlordId`, `leaseId`, `propertyId`, optional `unitId`, `responsibilityId`, supported `subjectKind`, `subjectId`, exact linked internal source IDs, internal reconciliation state, `schemaVersion`, and source revision. Provider identifiers and raw status remain excluded. Records lacking exact scope cannot be recovered by broad subject queries plus post-read filtering.

### `leaseCreditAllocationRecords`

The append-safe allocation source requires canonical scope, obligation key, allocated amount, currency, linked source IDs, created date, and explicit reversal linkage/state. Creator/reverser identity, email, notes, and reasons are excluded. Reversal records remain separate evidence; an original record is not overwritten into history loss.

### Obligation evidence

There is no approved obligation collection. Phase 0 obligations must be derived from the canonical lease schedule under a versioned `lease_obligation_derivation_v1` contract, then corroborated by eligible intent/payment/reconciliation/allocation evidence. The derivation produces preview obligations, never posted transactions. No new obligation collection is proposed in this phase.

## 9. Required read-only execution identity

The future adapter requires a dedicated workload identity rather than general application credentials where feasible. Its policy must prove:

- read-only access to the approved collections only;
- no create, update, delete, transaction write, batch write, Storage, secret, provider, payment-execution, or impersonation permission;
- environment and deployed revision binding;
- no broad portfolio enumeration endpoint or interactive user credential use;
- application validation of an immutable exact manifest before the first read;
- auditability of invocation category without financial fields or raw identifiers in ordinary logs; and
- emulator/policy tests plus independent IAM review.

Firestore client rules do not constrain trusted Admin SDK credentials. Client-rule success is therefore not proof of adapter authorization. IAM and application-scope enforcement require separate verification.

## 10. Exact query plan by evidence class

All queries use direct document reads or exact equality scope. `__name__` is the final deterministic tiebreaker. Dates below are examples of canonical ordering fields; implementation must use the approved persisted field type consistently.

| Class | Exact read/query | Deterministic order | Completeness rule |
| --- | --- | --- | --- |
| Ownership | direct `leases/{leaseId}`, then direct `properties/{propertyId}` | not applicable | Both exist, supported, same canonical landlord/boundary |
| Lease | reuse the exact direct lease read | not applicable | One supported document only |
| Property | reuse the exact direct property read | not applicable | One supported document only |
| Unit | direct `units/{unitId}` when assigned | not applicable | One supported document, or explicit no-unit state |
| Tenant | direct `tenants/{primaryTenantId}` | not applicable | One supported document |
| Ledger | `landlordId == L AND leaseId == X` | `effectiveDate ASC, __name__ ASC` | Exhaust all pages through as-of boundary; retain link-required history |
| Payments | `landlordId == L AND leaseId == X` | `effectiveDate ASC, __name__ ASC` | Exhaust all supported payment records |
| Rent payments | `landlordId == L AND leaseId == X` | `createdAt ASC, __name__ ASC` | Exhaust all pages; no provider fallback |
| Payment intents | `landlordId == L AND leaseId == X` | `createdAt ASC, __name__ ASC` | Exhaust all pages; unsupported states fail |
| Reconciliation | `landlordId == L AND leaseId == X` | `createdAt ASC, __name__ ASC` | Exhaust all pages and prove every eligible linked source represented or explicitly absent |
| Allocation | `landlordId == L AND leaseId == X` | `createdAt ASC, __name__ ASC` | Exhaust active and reversal history |
| Obligation | no collection query; versioned derivation from accepted lease/evidence receipts | stable obligation key | Derivation inputs complete and version exact |
| Legacy effects | independent mapping over accepted raw receipt records | source kind, effective date, source ID | Same complete raw universe; separate calculation path |

An as-of predicate may bound future-dated evidence only when the query plan proves that later records cannot reverse or link to earlier records needed for the snapshot. Otherwise the collection is exhausted and the adapter applies the as-of rule during safe projection, not authority filtering.

## 11. Required indexes

The checked-in index file does not currently define the required plans. The target compound indexes are:

| Collection | Required fields |
| --- | --- |
| `ledgerEntries` | `landlordId ASC, leaseId ASC, effectiveDate ASC, __name__ ASC` |
| `payments` | `landlordId ASC, leaseId ASC, effectiveDate ASC, __name__ ASC` |
| `rentPayments` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |
| `paymentIntents` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |
| `paymentReconciliationRecords` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |
| `leaseCreditAllocationRecords` | `landlordId ASC, leaseId ASC, createdAt ASC, __name__ ASC` |

If a reviewed as-of field is included as a range predicate, its exact order and tiebreaker require a separate enumerated index. Index changes are infrastructure/runtime prerequisites and are not authorized by this document. Emulator-only success does not prove production index availability.

## 12. Consistent-read and snapshot semantics

The receipt set must represent one coherent read boundary. A safe protocol must provide all of the following:

1. a manifest fixes landlord, lease, context, as-of date, query-plan version, and schema versions before reads;
2. each accepted source document exposes a comparable immutable `sourceRevision` or committed-at boundary;
3. the adapter records one internal boundary token/version for all receipts;
4. no accepted record is newer than the boundary;
5. pagination does not mix revisions after a retry;
6. ownership/mapping documents remain unchanged when financial reads complete; and
7. any detected change invalidates the whole receipt set and requires a full restart.

Because ordinary independent Firestore queries do not automatically provide a cross-collection snapshot token, Phase 0Q needs either a proven read-only transaction strategy within platform limits or an application high-watermark/source-revision protocol. Neither is established today. Timestamp sampling alone is insufficient.

## 13. Completeness proof rules

Each receipt must prove:

- the exact approved query plan and index version were used;
- all authority fields were query predicates rather than post-read filters;
- every page succeeded and its cursor continued exactly once;
- exhaustion was observed;
- no document was silently discarded for malformed or unsupported schema;
- every returned record passed exact landlord/lease/property integrity checks;
- the as-of and read-boundary rules passed;
- unsafe-field projection passed for every record; and
- relevant linked/reversal history was not excluded.

`empty_confirmed` means a successful, exact-scope, indexed, boundary-consistent, exhausted query returned zero eligible documents. Permission denial, missing index, unavailable service, timeout, cancellation, malformed schema, projection failure, or cap exhaustion is never empty.

## 14. Pagination and capped-query handling

- Use a versioned page size and maximum safety budget.
- Order by the evidence date/revision plus `__name__`.
- Continue with an immutable cursor from the last accepted document.
- Detect duplicate, skipped, regressed, or malformed cursors.
- Read through exhaustion; a fixed `limit(N)` alone is incomplete.
- If the safety maximum is reached before exhaustion, mark the source partial/truncated and reject it.
- Do not discard old evidence when later reversals, allocations, or links may refer to it.
- Retry only within a proven identical read boundary; otherwise restart the entire snapshot.
- Keep page/count proof internal and non-financial; do not emit lease-level counts in ordinary logs.

## 15. Post-read filtering prohibition

Every authority-relevant scope field must appear in the query. Per-record validation is defense in depth, not a substitute for exact querying.

Prohibited patterns include querying by lease and filtering landlord afterward; querying by tenant/property and inferring a lease; broad subject reconciliation queries; unioning owner aliases; or loading a whole landlord collection and filtering context in memory. Any authority-relevant post-read filtering sets `postReadFiltered: true`, and Phase 0N must reject the receipt.

## 16. Catch-to-empty prohibition

The adapter must distinguish confirmed missing/empty from permission denied, missing index, deadline, cancellation, unavailable service, malformed data, pagination failure, inconsistent boundary, and unexpected failure.

No `.catch(() => null)`, empty array, empty snapshot, or equivalent fallback is allowed. Only a successful absent direct document or successful exhausted zero-row exact query may become missing/empty. All other failures return bounded non-financial reason codes and no safe snapshot.

## 17. Alias-only ownership prohibition

The adapter must never prove ownership using `ownerId`, `ownerUserId`, `userId`, manager/staff membership, email, route identity, a `where("id")` fallback, first match, in-memory lease service, demo record, or seed fixture. Legacy-only or conflicting ownership documents are diagnostically ineligible until a separately approved canonicalization process proves and persists the canonical field.

## 18. Unsafe field exclusion/redaction rules

Raw snapshots must be projected immediately through per-collection allowlists before entering any Phase 0 component. Exclude:

- bank account, routing, transit, institution, mandate, IBAN, SWIFT, and payment-method data;
- processor/provider accounts, customers, sessions, payments, events, receipts, raw statuses, and metadata;
- credentials, secrets, tokens, API keys, auth headers, signatures, and encrypted blobs;
- Firestore references, document/collection paths, storage paths/URLs, buckets, and attachments;
- admin/support scope, impersonation data, staff assignments, review notes, and free-form reasons;
- tenant email, phone, screening, documents, messages, government identifiers, and unrelated PII;
- creator/reverser emails, notes, raw audit payloads, stack traces, and query objects.

Safe projections may retain only internal linkage necessary for Phase 0E, normalized dates, amounts, currency, supported status/type, canonical scope, schema/source versions, and safe nullable display labels. Diagnostic outputs and logs remain non-financial.

## 19. Query result manifest/versioning

Every future invocation must use an immutable manifest containing:

- manifest version and query-plan version;
- approved collection and schema versions;
- exact landlord, lease, context, as-of, and preview-through inputs;
- required receipt classes;
- index-plan identifiers;
- page size and safety maxima;
- read-boundary protocol version;
- projection/redaction version;
- obligation derivation version;
- Phase 0E normalization compatibility version; and
- allowlist version.

The adapter may return only receipt data plus bounded non-financial validation metadata. It must not return raw paths, cursors, snapshots, query text, financial totals, or identifiers in operator-facing output. Unknown or mixed versions fail closed.

## 20. Test requirements before adapter implementation

### Schema and ownership

- canonical lease/property/unit success;
- missing and unsupported schema versions;
- legacy-only, absent, and conflicting ownership aliases;
- cross-landlord property or unit;
- ambiguous tenant parties/responsibility;
- explicit no-unit versus missing-unit ambiguity;
- invalid rent, currency, frequency, date, and due-day fields; and
- display labels missing or equal to internal IDs.

### Exact query and indexes

- query-spy tests prove both landlord and lease predicates for every financial collection;
- deterministic order and `__name__` tiebreaker;
- required index available versus missing-index failure;
- no broad query, collection scan, alias union, or authority post-filter;
- emulator fixtures for zero, one, and multi-page results; and
- production index/IAM verification in an approved non-production environment before runtime adoption.

### Completeness and consistency

- confirmed empty versus permission/timeout/unavailable errors;
- one and multiple pages, exact exhaustion, duplicate cursor, skipped page, cap hit, and retry;
- concurrent update/read-boundary invalidation;
- mixed source revision rejection;
- linked history outside an ordinary date window retained; and
- whole snapshot restart after boundary failure.

### Evidence safety

- unsupported entry/status/source/currency fails;
- payment/ledger linkage and Phase 0E deduplication fixtures;
- reconciliation scope/link completeness;
- allocation and reversal chain completeness;
- write-off/reversal exact linkage;
- obligation derivation determinism and version mismatch;
- independent legacy effects do not reuse Phase 0 calculations; and
- unsafe bank/provider/admin/path/credential fields rejected before Phase 0N.

### Identity and non-goals

- read-only identity can read only approved collections;
- all writes, provider calls, secrets, Storage access, and broad enumeration fail;
- no route, job, scheduler, or UI imports the adapter;
- no runtime comparator/runner invocation; and
- outputs/logs contain no financial values or raw identifiers.

## 21. Non-goals

- no Firestore adapter or production source provider;
- no runtime Firestore read or write;
- no schema migration, backfill, index, IAM, infrastructure, or CI change;
- no job, scheduler, route, endpoint, UI, export, or landlord-visible financial read;
- no existing ledger behavior change;
- no payment mutation, provider integration, Rotessa, PAD, bank data, or money movement;
- no custody, pooled rent account, trust account, payout liability, or settlement float model;
- no treatment of tenant rent as RentChain revenue; and
- no RC1 demo behavior change.

## 22. Recommended next implementation PR, if safe

The implementation PR `backend/phase-0q-receivables-firestore-source-adapter-v1` is **not approved**.

The next safe branch is:

`audit/phase-0q-receivables-firestore-schema-migration-index-iam-rollout-v1`

That docs-only audit should define:

- compatibility inventory and population coverage for every required canonical field;
- canonicalization/backfill and conflict quarantine strategy;
- exact index rollout and rollback order;
- reconciliation scope/link migration plan;
- source-revision/read-boundary design;
- dedicated read-only workload identity and policy validation;
- non-production verification fixtures and acceptance thresholds; and
- separate implementation PR boundaries for schema writers/backfill, indexes/IAM, and only then the unmounted adapter.

Adapter implementation may be reconsidered only after those prerequisites are separately authorized, deployed, and proven against representative persisted data. If implementation is later approved, it must remain backend-only, read-only, unmounted, default-off, non-financial in output, and absent from routes, jobs, schedulers, and UI.

## 23. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| False ownership proof | Direct canonical lease/property reads; conflicts fail |
| Partial totals treated as authoritative | Exact indexed queries, exhaustion, whole-receipt rejection |
| Mixed temporal state | Versioned cross-source boundary; full restart on change |
| Duplicate payment evidence | Preserve links and overlapping sources for Phase 0E |
| Intent/reconciliation invents payment | Preview/corroborating roles only |
| History loss from reversals/write-offs | Append-safe records and exact reverse links |
| Legacy alias becomes permanent authority | Diagnostic ineligibility until approved canonicalization |
| Provider/bank/admin leakage | Immediate per-source allowlist projection and unsafe scan |
| Admin SDK overreach | Dedicated read-only identity and negative permission tests |
| Expensive/unbounded scans | Exact compound indexes, bounded pages, fail on safety cap |
| Error hidden as empty | Typed failures; catch-to-empty prohibited |
| Adapter becomes public endpoint | Keep unmounted, no route/job/UI imports |
| Roadmap mistaken for production capability | Label all adapter, PAD, and payment execution behavior future-only |

## Decision

Phase 0P establishes a target schema and exact-query contract, but it also confirms the repository is not ready for Phase 0Q adapter implementation. Canonical persisted scope, reconciliation linkage, required indexes, a coherent read-boundary protocol, and least-privilege execution identity must be designed, migrated, deployed, and verified first. Until then, Phase 0N remains pure, receipt-driven, unmounted, and uninvoked from runtime.
