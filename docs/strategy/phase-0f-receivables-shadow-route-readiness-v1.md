# Phase 0F Receivables Shadow-Route Readiness v1

Status: architecture audit only; the route remains unmounted and no runtime behavior is authorized by this document

## 1. Executive summary

RentChain is ready to consider one narrow Phase 0G implementation: a backend-only, read-only landlord receivables **shadow-comparison** route that is disabled by default, requires an explicit non-empty landlord allowlist, and has no frontend consumer. It is not ready for a public receivables route or for returning new financial totals to the landlord product.

Phase 0E removed an important accounting blocker by providing pure normalization, explicit source precedence, linkage-based deduplication, stable equivalence fixtures, and fail-closed ownership assertions. Three production-boundary concerns still have to be implemented and proven in Phase 0G:

1. a Firestore-authoritative loader must prove landlord/lease/property/tenant scope and distinguish confirmed-empty, unavailable, ambiguous, and truncated reads;
2. an independent legacy parity projection must compare the existing ledger effect with the Phase 0 balance from the same immutable snapshot and date boundary;
3. the route gate must be server-side, default-off, exact-allowlist-only, and evaluated before lease or accounting source reads.

The proposed future route is:

```text
GET /api/landlord/leases/:leaseId/receivables-summary
```

In Phase 0G it should act only as a shadow-validation endpoint. An authenticated, allowlisted landlord may trigger the comparison and receive a minimal validation envelope without financial totals. The full `LandlordLeaseReceivablesDto` may be assembled in memory for parity validation but must not be returned to a frontend consumer. Disabled, non-allowlisted, absent, and cross-landlord requests should share not-found semantics.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Any future PAD processor remains an execution/evidence adapter whose funds settle directly to the landlord/property-manager settlement context. The shadow route must not claim that RentChain initiated, received, held, pooled, safeguarded, settled, or paid out funds.

## 2. Current accounting foundation recap

### Phase 0 primitives: PR #1396

The accounting library provides pure CAD receivable transaction normalization, bounded monthly schedule previews, deterministic fingerprints, stale-state validation, balance projection, aging projection, rent-roll projection, and append-safe reversal validation. These functions calculate only from supplied inputs and do not establish production source authority.

### Phase 0B surface plan: PR #1397

The read-model plan separates lease receivables, tenant ledger, property rent roll, aging, statements/exports, and admin/support projections. It identifies the landlord lease receivables summary as the first bounded read model and avoids prematurely replacing the legacy ledger.

### Phase 0C DTO assembler: PR #1398

`assembleLandlordLeaseReceivablesDto` is pure and unmounted. It accepts explicit source and tenant-mapping states, produces a versioned landlord-safe DTO, keeps missing display labels nullable, suppresses unsafe financial summaries, compares a provided legacy balance, and allowlists warnings. It does not load or authorize records and does not independently calculate the legacy balance supplied to it.

### Phase 0D route gates: PR #1399

Phase 0D rejected immediate route mounting because the in-memory lease fallback did not independently prove ownership and overlapping legacy sources lacked canonical precedence and deduplication. It required exact cent parity, strict landlord scope, default-off gating, query-completeness semantics, and no legacy route change.

### Phase 0E source normalizer: PR #1400

`normalizeLegacyReceivablesSources` now:

- requires an `independently_verified` ownership proof matching the requested landlord and lease;
- validates landlord, lease, property, tenant, currency, amount, date, and transaction scope;
- deduplicates only explicitly linked equivalent evidence;
- applies deterministic source precedence, with ledger evidence leading linked equivalent representations;
- rejects unlinked exact matches, conflicting linked records, duplicate source evidence, and ambiguous mappings;
- prevents payment intents, reconciliation records, and allocation records from inventing receivable transactions;
- keeps lease obligations as preview evidence;
- produces deterministic transactions and a source fingerprint.

Phase 0E accepts injected records. It does not prove how production queries were completed, does not fetch Firestore, and does not calculate the independent legacy parity input. Those are Phase 0G gates, not reasons to weaken the pure normalizer.

## 3. Why a shadow route, not a public mounted route

A public endpoint would make the new balance contract part of product behavior before production source parity is known. A shadow route creates a bounded place to validate authorization, source completeness, normalization, parity, and response redaction without changing the legacy ledger or exposing financial totals to UI consumers.

The shadow route must have all of these properties:

- absent to ordinary callers through default-off and exact allowlist gates;
- read-only at the dependency and HTTP layers;
- invoked only by authenticated allowlisted landlord test accounts or an approved internal QA harness acting as that landlord;
- no navigation, dashboard, ledger, application, or frontend API integration;
- no new financial totals in the Phase 0G response;
- no background sweep over non-allowlisted portfolios;
- no fallback to in-memory lease records;
- no mutation, provider lookup, webhook processing, notification, decision, or audit-domain write;
- independently removable through a server-side kill switch without affecting the legacy route.

“Shadow” means compare two read projections from one authorized snapshot and record restricted operational evidence. It does not mean silently returning the new DTO alongside the legacy response, changing the existing ledger, or running against every landlord.

## 4. Proposed future route contract

### Path and method

```text
GET /api/landlord/leases/:leaseId/receivables-summary?asOfDate=YYYY-MM-DD&previewThroughDate=YYYY-MM-DD
```

Use a dedicated module such as `landlordLeaseReceivablesShadowRoutes.ts`, mounted under the existing `/api/landlord` route family. Do not add the handler to the broad legacy lease router and do not change `GET /api/leases/:leaseId/ledger`.

### Request rules

- `leaseId` is an opaque lookup key, never proof of authority or a display value.
- The server resolves landlord identity from verified authentication; it accepts no landlord, property, tenant, balance, currency, provider, or source-state parameter.
- `asOfDate` and `previewThroughDate`, if supported, use strict date-only UTC parsing and Phase 0 horizon bounds.
- The server resolves one immutable `asOfDate` once per request and applies it to both projections.
- Unknown query fields should be rejected or ignored under an explicit policy; they must never alter source selection.

### Phase 0G shadow response

For an allowlisted, owned, fully comparable lease, return a minimal non-financial envelope:

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "lease_receivables_shadow_validation_v1",
    "status": "equivalent"
  }
}
```

The Phase 0G response must not include balances, aging buckets, rent-roll totals, transaction rows, source fingerprints, internal IDs, source categories, provider state, or the assembled landlord DTO. A later separately approved phase may return `LandlordLeaseReceivablesDto` only after the promotion gates in this plan pass.

Recommended safe failures:

| Condition | HTTP | Safe code/behavior |
| --- | ---: | --- |
| Missing/invalid authentication | 401 | `UNAUTHORIZED` |
| Authenticated non-landlord audience | 403 | `FORBIDDEN` before accounting reads |
| Disabled, malformed/empty allowlist, or non-allowlisted landlord | 404 | `LEASE_RECEIVABLES_NOT_FOUND` |
| Lease absent or not owned | 404 | `LEASE_RECEIVABLES_NOT_FOUND` |
| Invalid/bounded date query | 400 | `INVALID_RECEIVABLES_QUERY` |
| Source unavailable, failed, or truncated | 503 | `RECEIVABLE_SOURCE_UNAVAILABLE` |
| Ownership, tenant, unit, or financial evidence ambiguous | 409 | `RECEIVABLE_SOURCE_AMBIGUOUS` |
| Legacy/Phase 0 mismatch or incomparable projection | 409 | `RECEIVABLE_SOURCE_EQUIVALENCE_REQUIRED` |
| Exact equivalent shadow comparison | 200 | minimal `equivalent` envelope only |

Do not expose whether a lease exists across landlord boundaries. Do not return a DTO with zero totals when source completeness is unproven.

## 5. Authorization and landlord ownership gates

Authorization order must be deterministic:

1. verified Firebase authentication;
2. strict landlord audience resolution;
3. global server-side route enablement;
4. exact server-resolved landlord allowlist membership;
5. Firestore-authoritative lease lookup;
6. exact lease `landlordId` match;
7. property, unit, tenant/responsibility, and evidence scope validation;
8. normalization and parity comparison.

`requireLandlord` derives a landlord context but historically permits some admin behavior. Phase 0G must use or add a strict landlord-only audience gate. An admin/support identity must not become an acting landlord implicitly. Any future admin diagnostic route requires a separate authority model and separate DTO.

Ownership proof passed to Phase 0E may be constructed only after a successful authoritative lease read whose canonical landlord matches the authenticated landlord. The existing in-memory lease fallback is not ownership proof and must never be used by this route in production or tests that claim production parity.

Every related record must match the already-authorized lease, landlord, and property scope. Conflicting evidence must be reported as ambiguity, not silently filtered into a plausible balance. Delegated/company access is excluded until an existing server-side relationship resolver proves explicit accounting permission, property scope, active status, and expiry.

## 6. Explicit allowlist / feature flag requirements

Use two independent server-side gates:

```text
LEASE_RECEIVABLES_SHADOW_ROUTE_ENABLED=false
LEASE_RECEIVABLES_SHADOW_LANDLORD_ALLOWLIST=<explicit landlord IDs>
```

Requirements:

- production and local defaults are disabled;
- both gates are required; an enabled flag with an empty, whitespace-only, wildcard, or malformed allowlist denies everyone;
- entries are exact canonical landlord IDs, trimmed and deduplicated; no email, domain, role, prefix, substring, regex, property, or client-provided match;
- the allowlist is evaluated after authentication and before lease/source queries;
- configuration is never returned to callers or logged as a list;
- an unrecognized environment value fails closed;
- tests restore environment state and prove no cross-test leakage;
- a kill-switch change disables all shadow reads without modifying the legacy ledger;
- no frontend capability flag, navigation item, entitlement, or optimistic route probe is added;
- production allowlist changes follow operator approval and least-access review.

An allowlist controls exposure; it does not replace lease ownership checks.

## 7. Required source inputs and normalization chain

The required chain is:

```text
authenticated landlord
  -> default-off and exact allowlist gate
  -> authoritative lease/property/unit/tenant snapshot
  -> bounded legacy ledger/payment/intent/reconciliation/obligation/allocation reads
  -> explicit query-completeness states
  -> Phase 0E normalizeLegacyReceivablesSources
  -> independent legacy signed-balance projection from the same snapshot
  -> exact parity gate
  -> Phase 0C assembleLandlordLeaseReceivablesDto in memory
  -> whitelist shadow-validation response
```

The loader should return an immutable internal bundle with per-source states: `complete`, `empty_confirmed`, `unavailable`, `ambiguous`, or `truncated`. A caught Firestore error is `unavailable`, never `[]`. Query limits must surface truncation rather than produce partial totals.

Required inputs include:

- authoritative lease identity, landlord, property, optional unit, tenant/responsibility relationship, status, billing terms, and source version;
- approved nullable display labels resolved without ID fallback;
- landlord/lease/property-scoped legacy ledger entries;
- canonical payment and rent-payment evidence;
- payment-intent and reconciliation evidence only for linkage/corroboration;
- obligation evidence only for preview/completeness comparison;
- allocation evidence only for lineage; it must not create a balance effect;
- an independently calculated legacy signed balance and effect counts;
- one strict `asOfDate` and bounded preview horizon.

Do not import route-local helpers that catch query failures as empty arrays or mix reads with provider enrichment, decisions, notifications, exports, or writes. Phase 0G may add a dedicated read loader with injected Firestore-like dependencies for tests, but no schema migration or write path.

## 8. Legacy equivalence and parity checks

Parity must compare the existing legacy ledger calculation and Phase 0 projections using the same authorized snapshot, scope, currency, and as-of boundary. It must not compare two values derived from the same new projection function and call that independent.

Required exact comparisons:

- legacy signed balance versus Phase 0 `netBalanceCents` in integer cents;
- total charge, reduction, reversal, adjustment-increase, adjustment-decrease, and write-off effects where legacy categories can be mapped safely;
- included/excluded effective-date boundaries;
- canonical payment and ledger deduplication count;
- reversal target and amount lineage;
- allocation treatment that does not change aggregate balance;
- CAD-only scope;
- lease, landlord, and property scope;
- deterministic normalized fingerprint stability for the same snapshot.

No tolerance, rounding band, inferred correction, or selection of the more favorable balance is allowed. If the legacy category cannot map exactly, the result is incomparable and no shadow success is returned.

Phase 0E proves linked-source equivalence for injected records, but Phase 0G still needs loader/parity fixtures for charge-only, confirmed empty, linked payment/ledger, two legitimate same-day payments, credit, both adjustment directions, reversal, write-off, overpayment, allocation, future-dated entries, missing due dates, unsupported categories, cross-scope records, query failure, and truncation.

Promotion toward a landlord DTO requires an operator-approved pilot sample with zero unexplained mismatches. Any corrected fixture or mapping rule must land as a reviewed code change; production evidence must not be edited to manufacture parity.

## 9. Fail-closed behavior

Financial comparison stops and returns no totals when any of these occur:

- authentication, audience, allowlist, or ownership is not exact;
- lease, property, unit, tenant, or responsibility scope is missing or ambiguous;
- a source query fails, times out, truncates, or cannot distinguish empty from unavailable;
- Phase 0E returns `incomplete` or `ambiguous`;
- unlinked exact matches or conflicting linked evidence exist;
- currency is unsupported;
- source amounts, dates, reversal targets, or transaction types are invalid;
- provider/intents/reconciliation/allocation evidence attempts to invent a transaction;
- the legacy calculation is unavailable, incomparable, or differs by one cent;
- Phase 0C returns unavailable financial summaries or a mismatch;
- an unexpected exception occurs.

Expected ambiguity uses safe 409 semantics. Infrastructure/source-read failure uses 503. Disabled and unauthorized-lease existence use indistinguishable 404 behavior. Unexpected failures are logged under a safe correlation ID and return a generic error without stack, query, collection, record, or provider detail.

A legitimate zero is returned only as an internal parity value after all required sources explicitly report complete or confirmed empty and both projections equal zero. The Phase 0G client envelope still contains no balance.

## 10. DTO safety and redaction rules

- The only candidate financial response for a later phase is `LandlordLeaseReceivablesDto`; never spread lease, Firestore, or normalizer records.
- Phase 0G returns only the minimal shadow status envelope, not the financial DTO.
- IDs remain lookup/scope values and never become labels or warning text.
- Missing property, unit, tenant, or responsibility labels remain null; no email, ID, provider reference, or path fallback.
- Internal findings, transaction IDs, source IDs, canonical event keys, linked-source IDs, fingerprints, query states, and collection names are not client fields.
- Provider, bank, payment-method, settlement, custody, storage, support, and audit metadata are excluded.
- Set `Cache-Control: private, no-store`; do not cache across landlord, lease, date, schema, or source boundaries.
- The response must not claim payment initiation, receipt, settlement, custody, payout, legal arrears, collection eligibility, accounting close, or bank reconciliation.

## 11. Observability and audit logging considerations

Shadow comparison needs operational observability without creating a financial audit record or leaking sensitive dimensions.

Allowed structured telemetry:

- route schema/version;
- deployment/environment;
- result category such as `equivalent`, `mismatch`, `ambiguous`, `source_unavailable`, or `not_allowed`;
- safe source-class counts, bounded timing, and normalized/legacy effect counts;
- a request correlation ID;
- one-way keyed diagnostic fingerprints only if access, rotation, retention, and non-client exposure are documented.

Do not log raw landlord, lease, property, unit, tenant, payment, intent, allocation, reconciliation, transaction, provider, or bank identifiers; raw records; display names; emails; query payloads; allowlist contents; or balances in general application logs.

Phase 0G should not write Firestore audit events merely because a GET comparison ran. If durable pilot evidence is later required, define a separate restricted, append-safe, retention-governed diagnostic store with explicit approval. Metrics must use bounded labels and must not use internal IDs as dimensions. Alert on mismatch rate, source-unavailable rate, ambiguity rate, latency, and unexpected exceptions; do not auto-remediate or mutate accounting data.

## 12. Test plan

### Gate and authorization tests

- flag absent, false, malformed, or unknown denies before lease reads;
- allowlist absent, empty, whitespace, wildcard, malformed, or non-matching denies before lease reads;
- exact allowlisted landlord continues;
- tenant, contractor, admin without acting context, unauthenticated, and forged client landlord values are denied;
- absent and cross-landlord leases share 404 semantics;
- authoritative ownership proof is required and in-memory fallback is never invoked;
- related cross-landlord/property/lease records fail closed.

### Loader and completeness tests

- each source distinguishes complete-empty from unavailable, ambiguous, and truncated;
- all reads use the authorized lease/landlord scope and one as-of date;
- timeouts and partial parallel reads return unavailable;
- unit and tenant aliases cannot select the first candidate silently;
- input bundles are immutable and deterministic;
- no provider client, webhook, mutation service, or route-local write helper is imported.

### Normalization, parity, and assembler tests

- retain all Phase 0 through Phase 0E suites;
- cover the fixture classes in the parity section;
- prove exact cent equality and one-cent mismatch failure;
- prove two legitimate identical-value events are not collapsed without linkage;
- prove allocations do not change aggregate balance;
- prove intents/reconciliation cannot create transactions;
- prove mismatch suppresses shadow success and all financial response fields;
- prove normalized output can feed Phase 0C in memory without unsafe warnings or ID fallbacks;
- prove changed evidence changes the normalized fingerprint.

### Route and no-side-effect tests

- response schema is exact and contains no unexpected keys;
- failures contain no raw IDs, source fields, provider labels, paths, or internal findings;
- GET performs no `create`, `set`, `update`, `delete`, batch, transaction, event append, notification, provider, or payment mutation call;
- `Cache-Control` is private/no-store;
- rate and date bounds are enforced;
- route ordering does not shadow other landlord lease routes;
- existing legacy ledger fixtures/responses remain unchanged;
- environment state and allowlists do not leak between tests.

### Delivery validation

- targeted accounting, loader, auth, route, and legacy ledger regression suites;
- backend TypeScript production build;
- `git diff --check` and forbidden-scope/import scans;
- exact PR-head Cloud Run preview deployment before authenticated QA;
- no frontend build requirement beyond ordinary CI because Phase 0G has no frontend change.

## 13. Manual QA plan once route is implemented

Manual QA is not required for this docs-only audit. For Phase 0G, QA must use the exact deployed PR head and approved non-production test identities/data.

1. With the global flag off, confirm an authenticated allowlisted landlord receives not-found semantics and source read counters remain zero.
2. With the flag on and an empty/non-matching allowlist, confirm the same result and zero source reads.
3. With both gates enabled, confirm a non-allowlisted landlord and a cross-landlord lease cannot distinguish existence.
4. Confirm an allowlisted landlord can validate only an owned lease.
5. Confirm an equivalent fixture returns only the minimal shadow envelope, never financial totals.
6. Confirm mismatch, ambiguity, query failure, truncation, unsupported currency, and invalid dates return the planned safe errors without totals.
7. Confirm no source IDs, fingerprints, provider labels, storage paths, bank fields, stack traces, or collection names appear.
8. Confirm no Firestore documents, payment state, allocations, decisions, messages, notifications, or provider state change before/after GET requests.
9. Confirm the legacy ledger route is byte/fixture compatible and frontend behavior is unchanged.
10. Disable the kill switch and confirm access stops without a deployment or legacy behavior change.

Production data must not be modified for QA. Cross-landlord testing must use approved fixtures or test tenants and must not attempt auth bypass.

## 14. Non-goals

- No route, loader, middleware, mount, environment variable, or feature flag implementation in Phase 0F.
- No public or generally available receivables endpoint.
- No frontend client, UI, navigation, dashboard card, ledger replacement, or RC1 behavior change.
- No Firestore write, migration, backfill, schema rewrite, or durable shadow-result store.
- No payment, allocation, reconciliation, decision, notification, or workflow mutation.
- No Rotessa/PAD or other provider integration, credential, webhook, polling, or status claim.
- No PAD mandate, authorization, scheduling, initiation, retry, return, cancellation, or payment-method collection.
- No tenant bank data, money movement, funds custody, pooled rent account, trust accounting, settlement float, payout, or landlord payout liability.
- No treatment of tenant rent as RentChain revenue.
- No tenant, admin/support, owner statement, export, general ledger, tax, close, or bank-reconciliation surface.

## 15. Recommended future implementation PR

Proceed conditionally with:

```text
backend/phase-0g-receivables-summary-shadow-route-v1
```

Phase 0G may implement only:

- a strict landlord-only authorization and default-off/exact-allowlist gate;
- a Firestore-authoritative, read-only source loader with explicit completeness states and injected test dependencies;
- an independent legacy parity projection from the same immutable snapshot;
- the Phase 0E -> parity -> Phase 0C in-memory chain;
- a dedicated shadow route returning only the minimal validation envelope;
- restricted aggregate telemetry and comprehensive no-side-effect/auth/parity tests;
- unchanged legacy ledger behavior and no frontend consumer.

Phase 0G must remain disabled by default after merge. It must not return `LandlordLeaseReceivablesDto` or financial totals to the product. If the implementation cannot independently prove ownership, source completeness, and legacy parity without importing permissive route-local helpers, stop and split the loader/parity work into another unmounted backend PR instead of weakening the gates.

Promotion beyond shadow comparison requires a separate audit and explicit operator approval after exact-head deployment QA and zero unexplained mismatches across approved fixtures and a bounded pilot sample.

## 16. Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| Default-open or wildcard configuration | Unreviewed financial exposure | Default false; exact non-empty allowlist; deny malformed values |
| Allowlist treated as ownership | Cross-landlord disclosure | Authoritative lease lookup and exact landlord match remain mandatory |
| In-memory lease fallback | Unproven financial authority | Prohibit fallback; test it is never invoked |
| Query failure becomes empty | False zero balance | Explicit completeness states; 503 on unavailable/truncated reads |
| Legacy and Phase 0 use different snapshots | Meaningless parity result | One immutable bundle and one as-of boundary |
| Same new logic computes both sides | Circular equivalence proof | Independent legacy signed-effect projection |
| Overlapping evidence double-counted | Understated receivable balance | Phase 0E explicit linkage, precedence, and ambiguity failure |
| Provider state treated as payment | False settlement/custody claim | Intents/reconciliation remain corroborating only |
| Allocation creates a credit | Incorrect aggregate balance | Allocation is lineage only; parity fixture enforces no balance effect |
| Internal IDs or findings leak | Privacy and support-data exposure | Minimal Phase 0G envelope and exact response-shape tests |
| Shadow becomes de facto public API | Premature contract commitment | No UI consumer; allowlist; separate promotion audit |
| GET creates audit or workflow records | Side effects and history corruption | Read-only dependency graph and write-spy tests |
| High-cardinality telemetry leaks scope | Privacy/cost risk | Bounded result categories; no IDs as metric dimensions |
| New route changes legacy ledger | RC1 regression | Dedicated path; legacy fixture compatibility; kill switch |

## Decision

Phase 0E is sufficient to permit a narrowly scoped Phase 0G shadow-route implementation, but not a public landlord receivables response. Phase 0G must implement the remaining production loader, independent parity, authorization, default-off allowlist, and no-side-effect gates together. It must return only a minimal validation status, remain unconsumed by the frontend, and stay disabled by default after merge. Any inability to satisfy those conditions is a stop condition, not permission to relax them.
