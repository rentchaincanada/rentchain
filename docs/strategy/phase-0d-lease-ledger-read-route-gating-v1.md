# Phase 0D Lease Ledger Read-Route Gating v1

Status: architecture audit only; no route, loader, Firestore, UI, provider, payment, or RC1 behavior is authorized

## Executive summary

PR #1396 established pure receivables primitives. PR #1397 defined the read-model surface sequence. PR #1398 added the pure, unmounted `assembleLandlordLeaseReceivablesDto` contract. The next architectural problem is not HTTP serialization; it is proving that real lease, ledger, payment, allocation, and display records can be mapped into the Phase 0 contracts without double counting, guessing authority, or returning a plausible but incomplete balance.

A future route may use:

```text
GET /api/landlord/leases/:leaseId/receivables-summary
```

This path is consistent with the existing landlord namespace and the existing `/api/landlord/leases` mount. It should live in a dedicated landlord receivables router rather than modifying `GET /api/leases/:leaseId/ledger`. The legacy route must remain unchanged until the new route has passed source-equivalence, authorization, completeness, and pilot-readiness gates.

The route is not safe to mount yet. Two blockers require implementation and fixture proof first:

1. The current `getLeaseEntityForLandlord` helper can fall back from a missing Firestore lease to an in-memory lease without independently proving the fallback record belongs to the authenticated landlord. Financial reads must not use that fallback.
2. `ledgerEntries`, `payments`, `rentPayments`, `paymentIntents`, reconciliation records, obligation rows, and credit allocations overlap. There is no Phase 0 transaction-source adapter with documented precedence, deduplication, reversal lineage, and completeness semantics.

The safe next PR is an unmounted, backend-only legacy receivables source-normalization and equivalence module with injected inputs and tests. It should not read Firestore or add a route. A later PR may add a read-only loader and a disabled-by-default, landlord-allowlisted route after the source contract is accepted.

Tenant rent remains landlord/property-manager revenue, never RentChain revenue. Any future processor settles directly to the landlord/property-manager settlement context. This route must not imply that RentChain initiated a debit, received, held, pooled, safeguarded, settled, or paid out funds. Rotessa, PAD, bank data, provider actions, and payment mutation remain out of scope.

## Current accounting foundation recap

### Phase 0 primitives

The accounting library now provides pure functions for:

- normalized CAD receivable transactions;
- bounded monthly charge-schedule previews;
- deterministic fingerprints and stale-state validation;
- balance projection;
- due-date aging projection;
- property/lease rent-roll projection.

These functions do not decide which legacy records are authoritative. They accept provided inputs and fail closed on invalid transaction-level data.

### Phase 0C assembler

`assembleLandlordLeaseReceivablesDto` composes the primitives into a landlord-safe DTO. It:

- keeps display fields nullable rather than falling back to internal identifiers;
- requires explicit transaction-source and tenant-mapping states;
- can compare a provided legacy balance with the Phase 0 balance;
- returns null financial summaries for unsafe source state or equivalence mismatch;
- detects a stale expected schedule fingerprint;
- maps internal findings into allowlisted landlord-safe warnings;
- remains pure and unmounted.

The assembler deliberately does not fetch lease, property, unit, tenant, ledger, payment, allocation, or provider records. A future route therefore needs a separate source loader and a separate legacy-to-Phase-0 normalizer.

### Existing lease ledger

`GET /api/leases/:leaseId/ledger` currently:

- uses `requireLandlord`;
- loads landlord-scoped `ledgerEntries`;
- reads rent-payment, payment-intent, canonical-payment, reconciliation, credit-allocation, decision, and obligation sources;
- computes signed running balance and monthly totals from legacy ledger entry types;
- exposes obligation, delinquency, and decision projections;
- shares adjacent charge/payment mutation and CSV/PDF routes.

The future receivables summary must not alter this route or reuse its mutation surface. It may reuse audited pure helpers, but it must not import route-local behavior that mixes presentation, Firestore reads, provider enrichment, decisions, and writes.

## Proposed future read route

### Path and module

Recommended future path:

```text
GET /api/landlord/leases/:leaseId/receivables-summary?asOfDate=YYYY-MM-DD&previewThroughDate=YYYY-MM-DD
```

Recommended module and mount:

```text
rentchain-api/src/routes/landlordLeaseReceivablesRoutes.ts
mounted at /api/landlord/leases
router path /:leaseId/receivables-summary
```

This keeps the new read model explicit, landlord-only, versionable, and separate from the legacy ledger. It is more consistent with the newer landlord route family than adding another behavior to the broad legacy lease router.

### Request contract

- `leaseId`: opaque lookup key only; never authority or display context.
- `asOfDate`: optional strict date-only value. If absent, the server resolves one UTC date once per request. The client may not supply a future date beyond an approved bound.
- `previewThroughDate`: optional strict date-only value bounded to the Phase 0 maximum schedule horizon and lease end.
- optional `If-None-Match` or expected source fingerprint may be considered later for caching, but it must not be treated as authorization or source truth.
- no landlord, property, unit, tenant, balance, allocation, currency, provider, settlement, or source-state parameters may be accepted from the client.

### Response and error contract

Successful responses return only the versioned landlord-safe DTO:

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "landlord_lease_receivables_v1"
  }
}
```

Recommended failure semantics:

| Condition | Status | Safe code | Rule |
| --- | ---: | --- | --- |
| Missing/invalid authentication | 401 | `UNAUTHORIZED` | No source reads after auth failure |
| Authenticated non-landlord audience | 403 | `FORBIDDEN` | Admin/support needs a separate explicit route and authority model |
| Lease absent or not owned | 404 | `LEASE_RECEIVABLES_NOT_FOUND` | Do not reveal cross-landlord lease existence |
| Feature disabled or landlord not allowlisted | 404 | `LEASE_RECEIVABLES_NOT_FOUND` | Dark route should not advertise pilot availability |
| Invalid date query | 400 | `INVALID_RECEIVABLES_QUERY` | No guessed date parsing |
| Source read failure | 503 | `RECEIVABLE_SOURCE_UNAVAILABLE` | Do not convert query failure into an empty ledger |
| Ambiguous ownership/tenant/unit/source mapping | 409 | `RECEIVABLE_SOURCE_AMBIGUOUS` | No guessed mapping and no financial totals |
| Legacy equivalence mismatch | 409 | `RECEIVABLE_SOURCE_EQUIVALENCE_REQUIRED` | No financial totals returned |
| Complete source with legitimate empty history | 200 | DTO with confirmed zero balance | Only when completeness is explicitly proven |
| Non-financial display label missing | 200 | Partial DTO with null label | Never substitute internal ID |
| Schedule terms missing but transaction source valid | 200 | Partial DTO; schedule/rent-roll unavailable | Balance/aging may remain available if their source is complete |

Do not return stack traces, Firestore errors, query shapes, source collection names, document IDs, provider references, storage paths, or internal findings.

## Required source mappings

The route loader must produce one immutable input bundle for one authenticated landlord and lease. Each source must carry an explicit result state: `complete`, `empty_confirmed`, `unavailable`, or `ambiguous`. A caught Firestore error is `unavailable`, never an empty array.

### Lease source

| DTO/assembler input | Candidate lease fields | Gate |
| --- | --- | --- |
| `leaseId` | Firestore lease document ID | Lookup only; never display label |
| `propertyId` | `propertyId` | Required and ownership-checked |
| `unitId` | `unitId` plus canonical unit resolver | Nullable only if the lease truly has no unit; ambiguity fails |
| `tenantId` / responsibility | canonical responsibility or exactly one resolved primary tenant | Multiple unmatched candidates fail |
| lease start/end | canonical `startDate`/`endDate` after strict date-only normalization | Missing start makes schedule unavailable |
| monthly rent cents | canonical rent field with explicit dollars-to-cents policy | Positive safe integer cents; no floating or latest-payment inference |
| due day | explicit canonical due day | Do not silently default to day 1 for historical records |
| billing frequency | explicit supported value | Only monthly in Phase 0; missing/other values make schedule unavailable |
| currency | explicit canonical currency or approved CAD-only migration invariant | Do not infer from locale |
| source lease version | immutable version/revision or stable normalized lease fingerprint | `updatedAt` alone is acceptable only if its semantics are proven |
| lease status | canonical lifecycle mapper | Unknown remains unknown; no provider status |

The current lease route normalizes several aliases and sometimes falls back between fields. The source adapter must document accepted aliases and ambiguity rules rather than duplicating permissive `String(value || "")` behavior.

### Property and unit display source

- Load the property under the authenticated landlord scope, not by unscoped ID alone.
- Resolve the unit through one canonical property/unit resolver.
- If standalone and nested unit records disagree, mark unit mapping ambiguous.
- Build display names only from approved name/address/unit-label fields.
- Never use the property document ID, unit ID, storage reference, or raw path as a label.
- Missing labels produce null/partial DTO state; ownership ambiguity produces a hard failure.

### Tenant and responsibility source

- Resolve tenant context from the lease's canonical responsibility/primary-tenant relationship.
- Verify the tenant is linked to the same lease and landlord scope.
- If `tenantId`, `primaryTenantId`, and `tenantIds` disagree, do not select the first value silently.
- A multi-tenant lease requires an explicit responsibility model or a documented landlord-safe combined display policy.
- Tenant display names come from approved display fields only; email, raw tenant ID, provider customer ID, or application ID are not fallback labels.
- Missing display name may be partial; missing or ambiguous relationship makes financial output unavailable.

### Receivable transaction source

The first source adapter should normalize legacy records before the assembler runs. It must not pass raw provider or Firestore payloads directly as transactions.

| Legacy evidence | Phase 0 candidate | Required rule |
| --- | --- | --- |
| `ledgerEntries` charge with canonical scheduled-rent lineage | `scheduled_rent_charge` | Requires due date, period, lease scope, amount, and schedule/source version |
| Other supported charge | `one_time_charge` or `deposit_charge` | Explicit category mapping; unsupported fee categories fail review |
| Canonical applied payment linked to ledger evidence | `payment_applied` | One accounting transaction per payment; exact dedup key and effective date |
| Legacy negative adjustment/credit | `credit` or decreasing `adjustment` | Mapping policy must distinguish commercial credit from correction |
| Positive adjustment | increasing `adjustment` | Positive magnitude plus explicit direction |
| Payment reversal evidence | `payment_reversal` | Exact target, amount, scope, currency, and single-reversal lineage |
| Write-off record | `write_off` | Explicit authorized accounting record; never inferred from delinquency or provider failure |
| NSF/return evidence | review finding until policy exists | Phase 0 does not enable automatic NSF fees |
| Credit-allocation record | allocation lineage on reduction | Must not change aggregate balance or create a second payment |
| Payment intent/provider status | no receivable transaction by itself | Transport, authorization, or provider success is not accounting settlement |
| Reconciliation record | evidence supporting canonical payment/reversal state | Must not duplicate the accounting effect |
| Obligation row | schedule/completeness comparison | Derived row is not a second charge source |
| Decision/delinquency signal | no accounting transaction | Operational projections never change balance |

### Source precedence and deduplication

The adapter must define one canonical effect for each real-world charge, payment, credit, reversal, write-off, or adjustment. At minimum:

1. Prefer explicit append-safe canonical accounting records when available.
2. Use a linked `ledgerEntry` as accounting evidence only once.
3. Treat `payments`, `rentPayments`, intents, reconciliation records, and ledger entries as potentially overlapping evidence until links prove identity.
4. Never sum both a canonical payment and its linked ledger entry.
5. Never synthesize payment application from provider status alone.
6. Preserve reversals as new records; never edit or delete the original payment.
7. Preserve credit-allocation lineage without changing aggregate balance.
8. Reject duplicate transaction IDs, duplicate effect fingerprints, cross-lease links, currency mismatch, amount mismatch, and missing reversal target.
9. Produce a deterministic source fingerprint after normalization and before projection.

## Authorization and landlord scope gates

### Authentication and role

- Run verified Firebase authentication before any Firestore read.
- Require an authenticated landlord audience for the first route.
- `requireLandlord` currently allows both landlord and admin roles. The new route must add a stricter audience gate or a server-resolved acting-landlord context. An admin ID must not be treated automatically as a landlord ID.
- Admin/support diagnostics, if later required, need a separate admin-only route and DTO. They must not reuse the landlord endpoint as a privilege shortcut.

### Lease ownership

- Resolve `landlordId` only from verified server-side authority.
- Fetch the Firestore lease record and compare its canonical `landlordId` with the resolved authority.
- Return the same 404 for absent and cross-landlord leases.
- Do not query by client-supplied landlord/property/tenant IDs.
- Do not reuse the current in-memory fallback for financial reads. If a future fallback is required for tests, it must independently prove ownership and be disabled in production.

### Related-record scope

Every property, unit, tenant, transaction, allocation, payment, and reconciliation record must be checked against the already-authorized lease scope. A record matching only `leaseId` is insufficient when it has a conflicting landlord or property. Cross-scope records make the source ambiguous/unavailable and must not be filtered silently if their presence signals integrity risk.

Property-manager-company or delegated access is not automatically authorized by this plan. Supporting it requires the existing server-side relationship resolver, explicit accounting permission, company/property scope, expiry/status checks, and tests. Client claims are never sufficient.

### Information disclosure

- No cross-landlord existence oracle through 403/404 differences.
- No raw internal IDs in display fields, warnings, logs, metrics dimensions, or error messages.
- Structured logs may include a request/correlation ID and safe failure code; sensitive record IDs require restricted diagnostics and must not appear in client responses.
- Rate limiting and request-size/query bounds should match other sensitive landlord financial reads.

## Completeness and fail-closed rules

### Source-state matrix

| Source | Complete | Partial DTO allowed | Hard failure/unavailable |
| --- | --- | --- | --- |
| Authenticated landlord/lease ownership | Exact server-resolved match | No | Missing, cross-landlord, admin without acting context, ambiguous delegation |
| Transaction query | Query succeeded, full bounded scope known | No transactions only when empty is confirmed | Query failure, truncation, ambiguous overlap, unbounded result |
| Legacy equivalence | Exact cents and scope match | No | Mismatch or incomparable source |
| Tenant relationship | One approved relationship/responsibility | Missing display label only | Missing/ambiguous relationship |
| Property/unit relationship | Exact property ownership and unambiguous unit | Missing display label only | Conflicting property/unit scope |
| Billing terms | Valid monthly rent/start/due day/frequency | Balance/aging may return while schedule/rent-roll are null | Do not return schedule/rent-roll totals |
| As-of date | Strict valid date | No | Invalid/out-of-bound date |
| Display labels | Approved labels present | Null plus safe partial warning | Never ID fallback |

### Query completeness

- Every query helper must distinguish success-empty from failure-null.
- Any internal catch that returns `null` or `[]` after a Firestore error is insufficient for financial completeness.
- If result volume is bounded, the loader must know whether truncation occurred. Truncated source cannot produce a complete balance.
- All sources must use one resolved `asOfDate` and compatible effective-date rules.
- Future-dated transactions may support schedule context but must not enter an earlier balance.
- A route-level timeout or partial Promise result returns `503`, not a partially summed balance.

### Output completeness

- `complete`: source queries succeeded, authority is exact, normalized transactions are valid, equivalence matches, and display/schedule inputs are complete.
- `partial`: financial source and equivalence are complete, but non-financial labels or schedule-only terms are missing/stale.
- `unavailable`: transaction source, ownership, tenant relationship, normalized transaction integrity, or equivalence is incomplete/ambiguous.
- A DTO marked unavailable must have null balance, aging, and rent-roll summaries as enforced by Phase 0C.
- Never convert unavailable totals to zero.

## Legacy ledger equivalence requirements

Before any pilot response returns financial totals, compute both the legacy and Phase 0 views from the same authorized snapshot and as-of boundary.

Required comparison:

- legacy signed charge/payment/adjustment balance in integer cents;
- Phase 0 `netBalanceCents`;
- `outstandingCents = max(0, netBalanceCents)` and `overpaymentCents = max(0, -netBalanceCents)`;
- transaction/effect counts after documented deduplication;
- currency and lease/property scope;
- included effective-date range;
- reversal and allocation lineage;
- deterministic normalized source fingerprint.

Exact cent equality is required. No tolerance, rounding band, “close enough,” or selection of the more favorable value is permitted.

Fixture classes required before route mounting:

- charge-only and legitimate empty ledger;
- charge plus manual payment;
- canonical payment linked to one ledger entry;
- overlapping payment/rent-payment/intent evidence without double count;
- credit and increasing/decreasing adjustment;
- valid and invalid payment reversal;
- write-off;
- aggregate credit/overpayment;
- allocation that changes aging but not aggregate balance;
- future-dated entry excluded by as-of date;
- missing due date excluded from aging with unavailable/partial state as appropriate;
- duplicate, cross-lease, cross-property, and cross-landlord records;
- legacy negative adjustments and unsupported categories;
- Firestore query failure versus confirmed empty result.

A mismatch should emit restricted diagnostic evidence containing fingerprints, counts, and safe source categories—not raw client-facing records—and return `409 RECEIVABLE_SOURCE_EQUIVALENCE_REQUIRED` without totals.

## Feature-flag recommendation

Use a server-side, disabled-by-default two-part gate:

```text
LEASE_RECEIVABLES_READ_ROUTE_ENABLED=false
LEASE_RECEIVABLES_READ_ROUTE_LANDLORD_ALLOWLIST=<explicit landlord IDs>
```

Rules:

- Production default is disabled.
- An empty or malformed allowlist denies everyone; it must not mean “open in development.”
- Both global enablement and exact landlord allowlist membership are required.
- Evaluate the flag after authentication but before lease/source queries.
- The frontend must not control or infer the gate.
- Disabled/non-allowlisted requests return the same 404 as an unavailable route.
- Do not expose the allowlist, flag state, or landlord identifiers in responses.
- The route should begin in shadow comparison mode: load and compare sources, record restricted aggregate metrics, but do not return new totals to UI consumers.
- Promotion from shadow to read response requires zero unexplained equivalence mismatches across an approved fixture set and pilot sample.
- A kill switch must disable reads without a deployment and without changing legacy ledger behavior.

The first route implementation must not add a default-on flag, public entitlement, navigation item, or dashboard dependency.

## DTO safety rules

1. Return only `LandlordLeaseReceivablesDto`; never spread lease or Firestore records into the response.
2. Keep lease/property/unit/tenant/responsibility IDs server-internal and out of display labels and warnings.
3. Treat `sourceFingerprint` and schedule fingerprint as opaque validation values, never authority or human-readable references.
4. Use integer cents and CAD-only Phase 0 semantics.
5. Resolve dates once using strict date-only UTC rules.
6. Do not return internal `ReceivableFinding.transactionId` or field paths.
7. Keep provider, payment-intent, reconciliation, storage, support, audit, and bank metadata out of the landlord DTO.
8. Do not expose raw query completeness details; translate them to safe completeness state and codes.
9. Do not cache across landlord/lease/as-of/schema/source-fingerprint boundaries.
10. Set conservative private/no-store caching until authorization-safe cache behavior is explicitly designed.
11. Reads must not create ledger entries, allocation records, decisions, notifications, audit mutations, or provider calls.
12. The response must not claim payment receipt, provider settlement, funds custody, payout, legal delinquency, collection eligibility, or accounting close.

## Testing plan

### Pure source-normalizer tests

- every supported legacy entry mapping;
- deterministic ordering and fingerprints;
- exact money/date normalization;
- provider/payment evidence deduplication;
- allocation and reversal lineage;
- duplicate/cross-scope/unsupported records fail closed;
- query result state distinguishes confirmed empty, unavailable, ambiguous, and truncated;
- inputs are not mutated and no network/Firestore dependency exists.

### Loader tests

- authenticated landlord owns lease;
- missing lease and cross-landlord lease both return not-found semantics;
- admin without explicit acting-landlord context is denied;
- tenant/contractor audiences are denied before source reads;
- property, unit, tenant, and responsibility ownership/relationship checks;
- ambiguous tenant and unit aliases fail closed;
- every query is landlord/lease scoped and query failures remain failures;
- no in-memory ownership fallback in production;
- source snapshots use one as-of date and report truncation.

### Equivalence tests

- all fixture classes listed in the equivalence section;
- exact cent match requirement;
- mismatch suppresses all financial totals;
- schedule-only incompleteness does not erase an otherwise verified balance;
- legitimate empty source returns zero only after completeness proof;
- changed source changes the source fingerprint;
- stale schedule fingerprint returns safe partial state.

### Route tests

- feature flag off, malformed/empty allowlist, and non-allowlisted landlord return 404;
- allowed landlord receives versioned DTO only;
- invalid query dates return 400;
- source failure returns 503;
- ambiguity/equivalence failure returns safe 409 without totals;
- response contains no raw IDs, provider fields, paths, or internal findings;
- GET produces no Firestore writes, batch/transaction calls, event appends, notifications, provider calls, or state mutation;
- route precedence does not shadow lease-notice or legacy lease routes;
- legacy `GET /api/leases/:leaseId/ledger` response remains byte/fixture compatible.

### Validation and rollout

- existing Phase 0 accounting and Phase 0C assembler tests;
- backend TypeScript build;
- route ownership regression suite;
- focused Firestore mock/integration tests;
- `git diff --check` and forbidden-scope scans;
- Cloud Run preview deployment of the exact PR head before any pilot QA;
- authenticated negative cross-landlord testing without production-data mutation;
- shadow equivalence metrics reviewed before enabling read responses;
- no frontend/manual layout QA until a UI consumer is separately authorized.

## Non-goals

- No route, loader, middleware, feature flag, environment variable, or app mount in this audit.
- No frontend UI or existing ledger behavior change.
- No Firestore read/write implementation, migration, backfill, or schema change.
- No payment, allocation, reconciliation, decision, or workflow mutation.
- No Rotessa or other provider integration, credential, API call, webhook, polling, mapping, or status claim.
- No PAD authorization, mandate, scheduling, initiation, retry, return handling, or cancellation.
- No tenant bank data, payment-method collection, money movement, funds custody, pooled rent account, trust accounting, settlement float, payout, or landlord payout liability.
- No claim that tenant rent is RentChain revenue.
- No owner statement, export, general ledger, tax, bank-reconciliation, or accounting-close implementation.
- No tenant or admin/support receivables route.
- No RC1 demo behavior change.

## Recommended first implementation PR, if safe

Proceed with a backend-only **Phase 0E legacy lease receivables source normalizer and equivalence fixtures** PR. Keep it pure and unmounted.

Proposed scope:

- add explicit legacy source input/result types under `rentchain-api/src/lib/accounting/sourceAdapters`;
- accept injected lease-ledger, canonical-payment, allocation, reconciliation, and obligation evidence;
- normalize only approved evidence into `ReceivableTransaction` inputs;
- produce explicit `complete`, `empty_confirmed`, `unavailable`, or `ambiguous` source state;
- implement deterministic effect keys, deduplication, and source fingerprinting;
- compute the legacy signed balance and compare it with `projectReceivableBalance`;
- return safe equivalence status without throwing for expected data conflicts;
- add all legacy mapping/equivalence fixture classes listed above;
- do not import Express, Firebase/Firestore, route modules, frontend code, provider clients, or mutation services.

Do not add the route in Phase 0E. After the pure adapter is reviewed, a separate Phase 0F audit/implementation can add a read-only Firestore loader and shadow-only route behind the disabled-by-default allowlist. This sequence is safe because it proves accounting identity before adding authorization and production source access.

## Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| In-memory lease fallback bypasses ownership | Cross-landlord financial disclosure | Firestore-authoritative lookup; no unverified fallback |
| Admin treated as landlord | Support identity gains unintended portfolio access | Strict landlord audience or server-resolved acting context |
| Overlapping payment sources | Double-counted receipts and understated balance | Canonical effect keys, precedence, link validation, fixture proof |
| Query failure treated as empty | False zero balance | Explicit source result states; 503 on unavailable source |
| Missing due/billing terms guessed | Incorrect schedule or aging | Null schedule/rent-roll; no defaults or inferred dates |
| Unit/tenant alias ambiguity | Wrong person/property financial data | Exact relationship resolver; 409 and no totals |
| Legacy/Phase 0 mismatch | Conflicting product balances | Exact cent equivalence gate; shadow mode; kill switch |
| Provider status treated as settlement | False receipt/custody claim | Provider evidence is non-accounting until canonical application evidence exists |
| Raw IDs used as labels | Privacy and demo-safety failure | Whitelist DTO and null display fields |
| Feature flag defaults open | Premature production exposure | Default-off plus explicit non-empty allowlist |
| Partial/truncated query aggregated | Incomplete financial total | Full-snapshot completeness and truncation gate |
| GET produces side effects | Accounting/audit corruption | Read-only dependencies, write-spy tests, no mutation imports |
| New route changes legacy UI | RC1 regression | Separate path, no frontend consumer, legacy fixture compatibility |

## Decision

Do not mount a lease receivables route yet. First prove the legacy source adapter and exact balance equivalence in a pure Phase 0E module. After that, add a Firestore loader and shadow-only, landlord-allowlisted route in a separate change with strict ownership, completeness, no-side-effect, and cross-landlord tests. Only a later explicitly approved gate may return the new DTO to a frontend consumer.
