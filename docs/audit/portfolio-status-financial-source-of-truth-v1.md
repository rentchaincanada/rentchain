# Portfolio Status Financial Source Of Truth V1

## Scope

This audit defines reliable backend source-of-truth rules for Dashboard 2.0 Portfolio Status and Financial Snapshot.

It reviews:

- Occupancy source of truth.
- Rent collection source of truth.
- Vacancy source of truth.
- Financial snapshot source of truth.
- Data quality flags required before Dashboard 2.0 UI implementation.

This is documentation only. It does not change UI, routes, services, database records, payment workflows, deployment configuration, Cloud Run, Vercel, or tests.

## Executive Summary

Dashboard 2.0 should not build Portfolio Status or Financial Snapshot directly from today's dashboard rent fields. Current dashboard summary rent values are placeholder-safe and zeroed, while the reliable operational facts are split across properties, units, leases, tenant projections, ledger/payment records, payment readiness, and lease lifecycle/coherence helpers.

Recommended approach:

1. Use the merged normalized Decision Queue API for critical issue counts.
2. Use the pending read-only backend normalization service in PR #1191 once its narrow stabilization fixes land:
   - Service: `landlordPortfolioStatusFinancialService`.
   - Future route still needed: `GET /api/landlord/portfolio-status-financial-summary`.
3. Derive occupancy from deduped active property/unit records plus authoritative lease lifecycle and lease occupancy coherence, not from unit status alone.
4. Derive rent roll and expected rent from active/current executed leases with valid rent terms.
5. Derive collected rent and outstanding rent from landlord-scoped ledger/payment records through a backend aggregation layer, not frontend dashboard fallbacks.
6. Treat split, stale, null, and zeroed source fields as data quality signals rather than valid zero-value business results.

## Current Source Inventory

| Area | Current source | What it can support now | Source-of-truth confidence |
| --- | --- | --- | --- |
| Active property count | `GET /api/dashboard/summary`, property records scoped to landlord and active/visible portfolio state | Portfolio count and activation state. | Medium-high for count. |
| Unit count | `GET /api/dashboard/summary`, embedded `property.units` arrays | Basic total units count. | Medium; standalone `units` collection also exists and must be reconciled. |
| Tenant count | `GET /api/dashboard/summary`, active tenant records scoped to active property IDs | Basic active tenant count. | Medium; tenant/lease linkage can drift and should be checked against leases. |
| Lease lifecycle | `deriveLeaseLifecycleState`, lease records, signing/execution fields | Current, future, notice, terminal lease state. | High for lease state when source lease fields are present. |
| Occupancy coherence | `deriveLeaseOccupancyCoherence`, lease/unit/tenant/readiness inputs | Conflict and review flags across lease, unit, tenant, and payment readiness. | High for conflict detection; not yet a portfolio aggregate. |
| Payment readiness | `derivePaymentReadiness` | Rent-term/setup readiness. | High for setup readiness; not a collected-rent source. |
| Lease ledger | Lease ledger and ledger event routes | Per-lease activity and signed/document workflows. | Medium-high for lease-level history; needs portfolio aggregation. |
| Payments | Payment routes combining legacy payments, `rentPayments`, and ledger entries | Payment listing and payment record visibility. | Medium; source split requires canonical aggregation rules. |
| Dashboard rent fields | `GET /api/dashboard/summary` rent object | Not safe for Financial Snapshot. Values are currently zeroed. | Low for rent/financial use. |
| Dashboard overview | `/dashboard/overview` frontend callers and placeholder/fallback shapes | Not safe for Dashboard 2.0 financial truth. | Low until backend source is normalized and scoped. |
| Portfolio overview service | Existing portfolio overview-style service shapes | Useful reference shape only. | Low until landlord scoping and source rules are verified. |
| Decision Queue | Merged normalized decision queue service/API | Critical issue counts and top decision preview. | High for attention state. |

## Occupancy Source Of Truth

### Recommended Rule

Dashboard 2.0 should count occupancy from a backend-normalized unit/lease view:

1. Active portfolio properties define the set of properties in scope.
2. Deduped active units define total rentable unit count.
3. Lease lifecycle defines whether a lease is active, signed future, notice period, expired, terminated, cancelled, renewed, or draft.
4. Unit occupancy fields support the projection but do not override an authoritative executed/current lease.
5. Tenant current lease/status supports the projection but does not override lease lifecycle.
6. `deriveLeaseOccupancyCoherence` should produce review flags where sources disagree.

### Safe To Use Now

- Active/visible property filtering from the dashboard summary route as a starting count pattern.
- Unit identity from property/unit records after deduplication.
- Lease lifecycle from `deriveLeaseLifecycleState`.
- Coherence flags from `deriveLeaseOccupancyCoherence`.
- Tenant current lease linkage as supporting evidence only.

### Avoid

- Counting occupancy from `unit.status` or `unit.occupancyStatus` alone.
- Counting occupancy from tenant status alone.
- Counting occupancy from stale `currentLeaseId` without validating the lease state.
- Treating active lease records as occupied if lease execution is draft, blocked, cancelled, terminated, expired, or not current.
- Mixing embedded property units and standalone `units` collection rows without deduplication.

### Proposed Occupancy Output

```ts
type PortfolioOccupancySummary = {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  upcomingUnits: number;
  noticePeriodUnits: number;
  reviewRequiredUnits: number;
  occupancyRate: number | null;
  activeLeaseCount: number;
  executedActiveLeaseCount: number;
  signedFutureLeaseCount: number;
  inactiveLeaseCount: number;
  dataQualityFlags: PortfolioDataQualityFlag[];
};
```

### Occupancy Classification

| Classification | Recommended rule |
| --- | --- |
| Occupied | Unit is tied to a current active or notice-period executed lease, with no material conflict. |
| Upcoming | Unit is tied to a signed future lease. |
| Notice period | Lease lifecycle is notice period or move-out/notice state. |
| Vacant | Unit has no current/upcoming executed lease and is not hidden/archived. |
| Review required | Lease/unit/tenant sources conflict or the system cannot safely classify the unit. |

## Rent Collection Source Of Truth

### Recommended Rule

Financial Snapshot must separate rent terms from rent collection:

- Expected rent comes from active/current lease rent terms.
- Collected rent comes from ledger/payment records.
- Outstanding rent is derived from expected minus recognized collected amount for the period.
- Payment readiness can explain why setup is incomplete, but it must not be treated as collected rent or outstanding rent.

### Safe To Use Now

- Lease rent terms after readiness validation:
  - monthly rent amount.
  - rent due day.
  - payment method, as context only.
  - start/end date and lifecycle state.
- Payment readiness for setup warnings and data-quality context.
- Payment/ledger routes as evidence that landlord-scoped payment records exist.

### Use With Normalization

- `ledgerEvents`
- `ledgerEntries`
- `rentPayments`
- legacy `payments`

These records must be normalized server-side before Dashboard 2.0 uses them. A UI should not choose between these collections directly.

### Avoid

- `GET /api/dashboard/summary` rent object for collected, expected, or delinquent rent.
- `delinquentCount` from dashboard summary while it remains placeholder zero.
- Frontend fallback dashboard overview values.
- Payment setup/readiness as a substitute for payment activity.
- Legacy payment records without landlord scoping and deduplication.
- Treating missing payment source as zero collected without a data quality flag.

### Proposed Rent Output

```ts
type PortfolioRentSummary = {
  period: {
    month: string;
    startsAt: string;
    endsAt: string;
  };
  rentRollCents: number | null;
  expectedCurrentMonthCents: number | null;
  collectedCurrentMonthCents: number | null;
  outstandingCurrentMonthCents: number | null;
  collectionRate: number | null;
  activeLeaseRentTermsCount: number;
  leasesMissingRentTermsCount: number;
  paymentSourcesIncluded: Array<"ledgerEvents" | "ledgerEntries" | "rentPayments" | "payments">;
  dataQualityFlags: PortfolioDataQualityFlag[];
};
```

### Rent Calculation Rules

| Metric | Recommended source rule |
| --- | --- |
| Rent roll | Sum monthly rent for active/current executed leases with valid rent amount. |
| Expected current month rent | Sum current-month expected rent from active leases. V1 can use full monthly rent for leases active in the month; proration should be explicit if added later. |
| Collected current month rent | Sum landlord-scoped recognized rent payment records for the current month after dedupe. |
| Outstanding current month rent | `max(expected - collected, 0)` when both values are reliable. Return `null` plus flag when expected or collected source is incomplete. |
| Collection rate | `collected / expected` only when expected is greater than zero and collection source confidence is high enough. |
| Payment method | Context and setup readiness only; not proof of collection. |

## Vacancy Source Of Truth

### Recommended Rule

Vacancy should be derived from unit inventory plus lease lifecycle, not from unit status alone.

### Safe To Use Now

- Active property/unit inventory as the rentable unit base.
- Lease lifecycle state for active, upcoming, notice, and terminal status.
- Occupancy coherence flags for conflicts.

### Avoid

- Treating a missing current tenant as vacant if a signed future lease exists.
- Treating a stale occupied unit status as occupied when no executed active lease exists.
- Treating expired/terminated/cancelled leases as current occupancy.
- Treating archived or hidden units/properties as vacant inventory.

### Vacancy Metrics

| Metric | Recommended rule |
| --- | --- |
| Vacant units | Deduped active units without current/upcoming executed lease and without conflict. |
| Available units | Vacant units that are not hidden, archived, or blocked by maintenance/owner hold if that source is available. |
| Upcoming occupied units | Signed future leases that have not started. |
| Notice-period exposure | Units tied to notice-period leases. |
| Vacancy impact | Only compute when unit or lease market rent is available. Otherwise return unavailable, not zero. |
| Tenant status mismatches | Flag when tenant says active/current but no coherent current lease/unit relationship exists. |

## Financial Snapshot Source Of Truth

### Dashboard 2.0 Financial Snapshot Should Show

1. Current month expected rent.
2. Current month collected rent.
3. Current month outstanding rent.
4. Rent roll.
5. Vacancy impact when source confidence supports it.
6. Payment readiness warnings as context, not as financial results.

### Safe Now

- Use lease rent terms to show rent roll and expected rent only through a backend aggregate.
- Use recognized payment records only through a landlord-scoped, deduped backend aggregate.
- Use Decision Queue items for payment warnings/critical issues after the queue API merges.

### Must Be Avoided

- Current dashboard summary rent fields while they are zeroed.
- Placeholder `/dashboard/overview` values.
- Frontend service fallback values.
- Analytics/predictive revenue values as accounting facts.
- Any unscoped portfolio overview service.
- Any source that treats null or missing financial inputs as real zero-dollar performance.

## Data Quality Flags

The backend normalization service should return explicit data quality flags so Dashboard 2.0 can degrade honestly instead of showing false precision.

Recommended flags:

| Flag | Meaning | Dashboard behavior |
| --- | --- | --- |
| `dashboard_rent_fields_zeroed` | Existing dashboard rent values are placeholders. | Do not use for Financial Snapshot. |
| `payment_sources_split` | Rent/payment records exist in multiple source collections. | Show normalized values only after server dedupe. |
| `payment_source_unavailable` | Payment source could not be loaded or has insufficient confidence. | Show unavailable/degraded financial state, not zero. |
| `ledger_source_unavailable` | Ledger source could not be loaded. | Degrade collected/outstanding rent. |
| `unit_sources_split` | Embedded property units and standalone unit records both exist. | Deduplicate and flag review if counts disagree. |
| `unit_lease_occupancy_conflict` | Unit occupancy does not agree with lease lifecycle. | Classify current executed leases by lease lifecycle, then surface conflict/review context without undercounting occupancy. |
| `tenant_lease_link_conflict` | Tenant current lease/status does not agree with active lease projection. | Count as review required and route to tenant/lease workspace. |
| `missing_rent_terms` | Active/current lease lacks rent amount, due day, or required rent terms. | Exclude from confident expected rent and surface setup warning. |
| `stale_lifecycle_projection` | Lease status field and derived lifecycle disagree. | Use lifecycle helper and flag for review. |
| `vacancy_value_unavailable` | Vacancy count exists but rent/market rent value is missing. | Show vacancy count without dollar impact. |

## Backend Normalization Status

Before Dashboard 2.0 UI implementation, land the pending PR #1191 read-only backend service with narrow stabilization fixes for fail-closed landlord scoping and lease-authoritative occupancy classification.

Service:

```ts
landlordPortfolioStatusFinancialService
```

Responsibilities:

- Accept `landlordId`, `period`, and optional simple filters.
- Load landlord-scoped active properties.
- Load/deduplicate units from supported sources.
- Load landlord-scoped leases and derive lifecycle state.
- Load landlord-scoped tenants only as supporting current-lease evidence.
- Load landlord-scoped ledger/payment records.
- Normalize payment sources into a single current-period aggregate.
- Derive occupancy/vacancy states with review flags.
- Return financial results with confidence and data-quality flags.
- Never mutate records.
- Never write audit events.
- Never send notifications.

Future endpoint still needed:

```http
GET /api/landlord/portfolio-status-financial-summary
```

Suggested response:

```ts
type LandlordPortfolioStatusFinancialSummary = {
  ok: true;
  version: "portfolio_status_financial_source_v1";
  generatedAt: string;
  landlordId: string;
  period: {
    month: string;
    startsAt: string;
    endsAt: string;
  };
  portfolioStatus: PortfolioOccupancySummary;
  financialSnapshot: PortfolioRentSummary;
  sourceConfidence: {
    occupancy: "high" | "medium" | "low";
    financial: "high" | "medium" | "low";
    vacancy: "high" | "medium" | "low";
  };
  dataQualityFlags: PortfolioDataQualityFlag[];
};
```

## Dashboard 2.0 Source Recommendations

| Dashboard section | Use now | Avoid now | Required before implementation |
| --- | --- | --- | --- |
| Portfolio Status | Merged Decision Queue critical count; active property/unit counts with backend normalization after #1191 stabilization. | Unit status alone, tenant status alone, unscoped overview services. | Portfolio status normalization service and future route exposure. |
| Decision Queue | Merged normalized Decision Queue API. | Frontend-derived decision duplication. | None beyond API merge and route contract. |
| Upcoming Actions | Normalized upcoming queue items, lease notice summary as supporting context. | Mixing all lease guidance into Dashboard. | Queue-backed upcoming adapter. |
| Financial Snapshot | Normalized lease rent terms plus payment/ledger aggregation. | Dashboard summary rent fields, `/dashboard/overview` fallbacks. | Financial normalization service. |
| Portfolio Detail | Compact routing counts from active property/unit/lease/tenant sources. | Full source tables and raw readiness lists. | Same portfolio normalization service or a compact companion projection. |

## Required Tests Before Dashboard 2.0 UI

### Occupancy Tests

1. Active executed lease counts unit as occupied.
2. Signed future lease counts unit as upcoming, not occupied.
3. Notice-period lease counts unit as notice period.
4. Expired/terminated/cancelled lease does not count as occupied.
5. Unit marked occupied but no active executed lease becomes review required.
6. Active executed lease on unit marked vacant counts as occupied and produces a conflict/review flag.
7. Tenant active/current without coherent lease/unit relationship becomes review required.
8. Embedded property unit and standalone unit records are deduped.
9. Hidden/archived properties or units are excluded from active inventory.
10. Cross-landlord units, leases, tenants, and payments are excluded.

### Financial Tests

1. Active lease rent terms contribute to rent roll.
2. Missing rent amount excludes lease from confident expected rent and adds data quality flag.
3. Missing due day does not become zero expected rent silently.
4. Collected rent sums landlord-scoped recognized payments for the current period.
5. Duplicate legacy/payment/ledger records are deduped.
6. Cross-landlord payments are excluded even if tenant or lease IDs overlap.
7. Outstanding rent is expected minus collected when both sources are reliable.
8. Outstanding rent is unavailable/null with a flag when expected or collection source is unreliable.
9. Dashboard summary zero rent fields are not used by the normalization service.
10. Vacancy impact is unavailable/null when no source rent or market rent value exists.

### Data Quality Tests

1. Split payment sources produce `payment_sources_split`.
2. Split unit sources produce `unit_sources_split` when counts or identities disagree.
3. Stale lease lifecycle/status disagreement produces `stale_lifecycle_projection`.
4. Unit/lease occupancy mismatch produces `unit_lease_occupancy_conflict`.
5. Tenant/lease link mismatch produces `tenant_lease_link_conflict`.
6. Source loading failures degrade output without returning false zeros.

## Recommended Implementation Sequence

1. `feat/landlord-portfolio-status-financial-normalization-v1`
   - Land PR #1191 read-only backend service after narrow stabilization fixes.
   - No UI.
   - No source mutation.
   - Add occupancy, vacancy, rent, payment, and data-quality tests.

2. `feat/landlord-portfolio-status-financial-api-v1`
   - Expose landlord-authenticated read-only endpoint.
   - Include route version header.
   - Add authorization, filter, and empty-state route tests.

3. `feat/dashboard-2.0-operational-home-v1`
   - Build Dashboard 2.0 UI using:
     - Decision Queue API.
     - Portfolio status/financial summary API.
     - Existing workspace routes.

## Non-Goals

- No Dashboard 2.0 UI implementation.
- No Operations redesign.
- No route changes in this audit.
- No data mutation.
- No payment workflow changes.
- No accounting ledger rewrite.
- No production data migration.
- No new notification behavior.
