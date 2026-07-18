# Phase 0B Accounting Read-Model Surfaces v1

Status: strategy and audit only; no route, UI, persistence, export, provider, or payment behavior is authorized

## Executive summary

PR #1396 added pure receivables contracts and deterministic schedule, balance, aging, and rent-roll projections under `rentchain-api/src/lib/accounting`. Those primitives remain backend-only and unmounted. They do not read Firestore, expose an API, alter an existing ledger, move money, or establish that any payment was collected or settled.

The first later read surface should be the existing landlord lease ledger context, not a portfolio dashboard. A lease-scoped DTO is the smallest authority boundary, has an existing landlord-owned route and screen, and gives RentChain a place to reconcile legacy `ledgerEntries`, obligation rows, payment evidence, and Phase 0 findings before aggregating those facts. The first implementation should still be an unmounted, pure DTO assembler with tests. Route and UI changes should be separate, explicitly authorized phases.

The concepts must remain separate:

- A **lease ledger** is the authoritative receivables history and balance for one lease responsibility.
- A **tenant ledger** is a tenant-safe projection of only the obligations, payments, credits, and explanations that the tenant is authorized to see. It is not a cross-landlord or lifetime tenant account.
- A **property rent roll** is a landlord portfolio projection by property, unit, and lease as of one date. It is not a transaction ledger.
- An **aging report** explains outstanding receivables by due-date bucket. It is not a delinquency, legal, credit, or collection decision.
- An **owner/accounting statement** is a bounded report of supported receivable facts. It is not a general ledger, bank statement, trust statement, payout statement, tax statement, or proof of settlement.

RentChain remains authoritative for receivable charges, allocations, balances, aging, and accounting history. Tenant rent remains landlord revenue. It must never be presented as RentChain revenue. Any future processor must settle directly according to the landlord/payee arrangement; RentChain must not imply that it collected, held, pooled, safeguarded, or paid out tenant funds. Rotessa, PAD authorization, PAD scheduling, bank data, provider evidence, and money movement remain out of scope.

## Current accounting surface inventory

| Surface | Current accounting implication | Current source or behavior | Phase 0B use | Recommendation |
| --- | --- | --- | --- | --- |
| `/leases/:leaseId/ledger` | Strongest landlord-facing ledger and balance claim | `GET /api/leases/:leaseId/ledger` reads landlord-scoped `ledgerEntries`, payment evidence, obligations, allocations, decisions, and derives running/monthly totals | Lease balance, outstanding/overpayment split, aging summary, explicit findings, as-of metadata | First surface after a pure DTO assembler and source-mapping audit |
| `/leases/:leaseId/summary` | Lease status and next-action context; links to payment ledger | Lease lifecycle summary plus navigation | A compact, read-only accounting summary only after lease-ledger DTO is authoritative | Later consumer; no independent balance calculation |
| `/payments` | Landlord payment register and operational payment visibility | Existing payment records and payment-oriented actions | Link payment evidence to receivable effects without treating provider state as accounting truth | Keep payment register distinct from ledger; later show reconciliation status only |
| `/dashboard` | Portfolio headline and decision-preview context | Multiple operational/financial sources | Small reviewed totals or exception counts from a portfolio DTO | Do not calculate accounting totals in the page; consume only after rent-roll validation |
| `/operations` | Review queue and operational exceptions | Decision and workflow projections | Accounting review findings and stale/unallocated exceptions | Show workflow tasks, never mutate balances from preview cards |
| `/tenants` | Tenant detail can open/export a payment ledger and mixes tenant/lease modes | Tenant detail bundle, tenant ledger, and lease ledger navigation | Clarify current-lease scope and provide a safe landlord view of tenant-linked lease receivables | Do not create a lifetime tenant balance by summing unrelated leases |
| `/properties` | Occupancy rows link to lease payment ledgers | Property/unit/lease lifecycle sources | Property-level rent-roll entry point and summarized receivable status | Later, after rent-roll DTO and authority pagination are defined |
| Future rent roll | No dedicated canonical surface | Phase 0 `projectRentRoll` exists as a pure projection | Primary property/portfolio receivables view | Second major read surface after lease ledger |
| Future aging report | No dedicated canonical surface | Phase 0 `projectReceivableAging` exists | Explain outstanding balances by date bucket | Build from the same canonical input snapshot as rent roll |
| Future owner/accounting export | Existing lease CSV/PDF export is lease-ledger-specific | Legacy ledger export routes and labels | Bounded receivables statement/export | Last of these surfaces; requires report versioning and explicit exclusions |
| Admin/support accounting | Existing admin pages are not a canonical accounting console | Mixed admin/support routes | Diagnose source mapping, findings, and projection provenance | Add only if support need is demonstrated; never reuse landlord DTO wholesale |
| `/tenant/payments` and `/tenant/ledger` | Tenant-visible payment and ledger records | Tenant-safe projection services and tenant-scoped routes | Later tenant-safe subset of current-lease receivable facts | Separate whitelist DTO; never expose landlord/admin findings or source references |

There is also a generic ledger/event surface and several portfolio financial projections. They should not silently become the Phase 0 accounting source of truth. A later source-mapping phase must document which legacy records become each normalized `ReceivableTransaction` and how conflicts, duplicates, reversals, and missing lineage fail closed.

## Lease ledger read-model proposal

### Purpose and authority

The landlord lease ledger should be the first canonical read-model consumer because it is already the product's strongest balance-bearing surface. Its server-side loader must resolve the authenticated landlord and lease ownership. The client may pass a lease identifier only as a lookup key; it may not assert landlord, property, tenant, responsibility, or portfolio authority.

The Phase 0 projection should not be mixed directly into the existing route until source mapping is proven. During transition, legacy totals and Phase 0 totals should be compared in tests or restricted diagnostics. A mismatch must produce a review/error finding, not a silent choice of the more favorable balance.

### Proposed landlord lease DTO

```ts
type LandlordLeaseReceivablesReadModelV1 = {
  schemaVersion: "landlord_lease_receivables_v1";
  asOfDate: string; // YYYY-MM-DD, server normalized
  generatedAt: string; // ISO timestamp; freshness only, not accounting effective date
  currency: "cad";
  lease: {
    leaseRef: string; // opaque navigation reference, not a display label
    propertyLabel: string | null;
    unitLabel: string | null;
    tenantLabel: string | null;
    responsibilityLabel: string | null;
    leaseStatus: "active" | "signed_future" | "notice_period" | "ended" | "unknown";
  };
  balance: {
    chargesCents: number;
    creditsCents: number;
    appliedPaymentsCents: number;
    reversalsCents: number;
    writeOffsCents: number;
    adjustmentIncreasesCents: number;
    adjustmentDecreasesCents: number;
    netBalanceCents: number;
    outstandingCents: number;
    overpaymentCents: number;
  };
  aging: {
    currentCents: number;
    days1To30Cents: number;
    days31To60Cents: number;
    days61To90Cents: number;
    days90PlusCents: number;
    totalOutstandingCents: number;
    allocationPolicy: "explicit" | "oldest_due_first";
  };
  entries: Array<{
    entryRef: string; // opaque row key, not user-facing text
    effectiveDate: string;
    dueDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    type: "scheduled_rent_charge" | "deposit_charge" | "one_time_charge" | "credit" | "adjustment" | "payment_applied" | "payment_reversal" | "write_off";
    label: string;
    amountCents: number;
    balanceAfterCents: number | null;
    allocationState: "allocated" | "partially_allocated" | "unallocated" | "not_applicable" | "unknown";
  }>;
  findings: Array<{
    code: string; // allowlisted public/landlord code
    severity: "review" | "info";
    message: string;
  }>;
  completeness: {
    state: "complete" | "partial" | "unavailable";
    missing: string[]; // allowlisted domain labels only
  };
};
```

Landlord DTO findings must translate internal errors into safe, actionable language. Raw transaction IDs, Firestore paths, source collections, provider references, stack details, and storage references must stay server-side. Error-severity projection failures should generally make the balance unavailable rather than returning a number with a warning badge.

The existing charge/payment write controls and credit-allocation workflow are not authorized by this plan. Read-model adoption must not add, widen, or trigger a mutation.

## Rent roll read-model proposal

A rent roll is an as-of portfolio projection, not a ledger table. It should answer which leases are in scope, scheduled rent, current receivable position, and aging distribution. It should not infer occupancy, lease validity, or payment settlement solely from an accounting balance.

```ts
type AgingBucketsV1 = {
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
};

type RentRollTotalsV1 = {
  scheduledRentCents: number;
  currentBalanceCents: number;
  outstandingCents: number;
  overpaymentCents: number;
  leaseCount: number;
};

type LandlordRentRollReadModelV1 = {
  schemaVersion: "landlord_rent_roll_v1";
  asOfDate: string;
  generatedAt: string;
  currency: "cad";
  filters: {
    propertyRef: string | null;
    leaseStatuses: Array<"active" | "signed_future" | "notice_period" | "ended" | "unknown">;
  };
  portfolio: RentRollTotalsV1;
  properties: Array<{
    propertyRef: string;
    propertyLabel: string | null;
    totals: RentRollTotalsV1;
  }>;
  rows: Array<{
    leaseRef: string;
    propertyRef: string;
    propertyLabel: string | null;
    unitLabel: string | null;
    tenantLabel: string | null;
    leaseStatus: "active" | "signed_future" | "notice_period" | "ended" | "unknown";
    scheduledRentCents: number;
    currentBalanceCents: number;
    outstandingCents: number;
    overpaymentCents: number;
    nextDueDate: string | null;
    aging: AgingBucketsV1;
    completeness: "complete" | "partial" | "unavailable";
  }>;
  page: { cursor: string | null; hasMore: boolean };
  findingsSummary: { reviewCount: number; unavailableRowCount: number };
};
```

The first rent-roll route should be landlord-only, server-scoped, date-only, paginated, and bounded. Portfolio totals must be computed over the same authoritative snapshot as rows; they must not be a sum of whichever page happens to be loaded. Rows with unsafe or invalid financial inputs should remain identifiable by safe labels but must not contribute invented zero balances. The response should distinguish zero from unavailable.

## Aging report read-model proposal

The aging report should be a drillable explanation of receivables already represented in the rent roll. It must use the same as-of date, normalized transactions, reversal rules, and allocation policy. It must not maintain a separate balance formula.

```ts
type LandlordReceivablesAgingReadModelV1 = {
  schemaVersion: "landlord_receivables_aging_v1";
  asOfDate: string;
  generatedAt: string;
  currency: "cad";
  allocationPolicy: "explicit" | "oldest_due_first";
  totals: AgingBucketsV1 & { totalOutstandingCents: number };
  groups: Array<{
    propertyRef: string;
    propertyLabel: string | null;
    totals: AgingBucketsV1 & { totalOutstandingCents: number };
  }>;
  rows: Array<{
    leaseRef: string;
    propertyLabel: string | null;
    unitLabel: string | null;
    tenantLabel: string | null;
    dueDate: string;
    originalAmountCents: number;
    outstandingCents: number;
    daysPastDue: number;
    bucket: "current" | "days_1_30" | "days_31_60" | "days_61_90" | "days_90_plus";
  }>;
  completeness: { state: "complete" | "partial" | "unavailable"; excludedRowCount: number };
};
```

“Past due” is date arithmetic, not a legal conclusion. The UI and exports must not convert an aging bucket into delinquency status, credit reporting, eviction readiness, collection eligibility, or automated outreach. Unallocated credits and payments must be visible as review findings and must not be distributed by an undisclosed policy.

## Owner/accounting export proposal

The later export should be named a **receivables statement** until the supported accounting scope is broader. “Owner statement” can imply expenses, payables, reserves, management fees, trust balances, bank activity, distributions, tax treatment, and accounting-period close that Phase 0 does not support.

A future export package should include:

- report title, schema version, generated time, as-of date, reporting period, currency, and landlord-defined entity label;
- property and unit labels, lease/responsibility labels, opening supported receivable balance, charges, credits, applied payments, reversals, write-offs, adjustments, and closing supported receivable balance;
- aged outstanding receivables when an as-of date is supplied;
- safe completeness notes and explicit exclusions;
- a stable export fingerprint derived from the normalized input snapshot and report parameters;
- CSV for row-level analysis and PDF only after the same DTO is validated;
- no raw Firestore IDs, internal source IDs, storage paths, provider IDs, bank data, support notes, or unrestricted metadata.

Required disclaimer language should state that the report covers RentChain-supported receivable records only. It is not proof of funds receipt or settlement, a bank or trust statement, a payout report, a complete general ledger, a tax statement, or legal advice.

Export generation must be a pure consumer of a versioned read model. It must not close a period, post entries, mark payments settled, retry collections, or modify accounting history.

## Tenant-facing payment/accounting boundaries

Tenant-facing DTOs require an independent whitelist projection. They must be resolved from authenticated tenant relationships on the server and scoped to a specific current or historical lease the tenant is entitled to view.

Tenant-safe information may include:

- property/unit display label and lease period when already authorized;
- charge label, amount, due date, payment or credit amount, effective date, and readable status;
- balance and allocation explanation only when the underlying projection is complete;
- receipts or evidence already approved for tenant visibility;
- neutral missing-data and review language.

Tenant DTOs must exclude:

- landlord portfolio totals and other tenants or leases;
- internal transaction, lease, property, landlord, responsibility, allocation, reconciliation, or provider identifiers as labels;
- internal findings, fraud/risk/support notes, decision queues, collection strategy, or operational assignments;
- bank details, provider payloads, payout or settlement configuration;
- write controls and accounting policies that the tenant is not authorized to manage.

`/tenant/payments` should remain a payment/evidence view. `/tenant/ledger` should remain the chronological tenant-safe account projection. Neither should claim a debit was initiated, funds were received, or landlord settlement occurred unless separately supported by authoritative evidence. A tenant identity must never be treated as a globally shared accounting account across landlords.

## Admin/support boundaries

Admin/support accounting views are not required for the first read-model implementation. If later justified, use a separate DTO and route guarded by server-side admin/support authorization.

An admin/support view may expose projection provenance, source category, internal references, and normalized findings only to the minimum role needed for diagnosis. It must not expose tenant bank data or unrestricted provider payloads. It must not permit support staff to mutate charges, payments, allocations, or reversals through a read endpoint. Access to sensitive diagnostics should be audited.

The landlord DTO must not be reused as an admin DTO, and the admin DTO must never be returned to landlord or tenant clients. Support identifiers should be copyable only in explicitly admin-only diagnostic contexts, never substituted for property, unit, tenant, or lease labels.

## DTO safety rules

1. Resolve landlord, tenant, property, lease, responsibility, and portfolio authority server-side.
2. Use explicit versioned whitelist DTOs per audience and purpose.
3. Use integer cents and an explicit `cad` currency; never floating-point money.
4. Use strict date-only values for due/effective/as-of dates and ISO timestamps only for generation/audit time.
5. Include `asOfDate`, `generatedAt`, schema version, completeness, and projection policy.
6. Distinguish `0`, `null`, unavailable, and omitted. Do not turn missing data into zero.
7. Do not expose raw Firestore IDs, storage paths, provider IDs, source collection names, credentials, bank data, or unrestricted metadata.
8. Opaque references may support authorized navigation but must not become display labels or export columns.
9. Never accept client-computed balances, landlord IDs, aging buckets, allocation outcomes, or settlement state.
10. Derive lease ledger, rent roll, aging, and exports from one normalized transaction snapshot and compatible policies.
11. Fail closed on duplicate IDs, invalid dates/currency/amounts, reversal mismatch, cross-scope records, and unresolved source conflicts.
12. Translate internal findings into audience-safe messages; do not leak transaction IDs in landlord or tenant findings.
13. Keep payment execution/evidence status separate from receivable effect. Transport or provider success is not settlement.
14. Include deterministic ordering and bounded pagination/horizons.
15. Do not cache across authority boundaries; cache keys must include audience, authorized owner scope, as-of date, filters, schema version, and source version/fingerprint.
16. A read request must never create charges, allocate payments, close periods, enqueue PAD, or otherwise mutate workflow/accounting state.

## Missing-data handling

| Condition | Safe read behavior | Unsafe behavior to avoid |
| --- | --- | --- |
| Missing property/unit/tenant label | Return `null` and “Not provided” at presentation time | Display raw ID or storage path |
| Missing due date on a charge | Exclude it from aging, mark projection partial/review | Put it in “current” or guess a due date |
| Missing scheduled rent | Mark scheduled rent unavailable | Infer from the latest payment or use zero |
| Unsupported frequency/proration | Mark schedule unavailable or review-required | Silently convert to monthly or prorate |
| Unallocated payment/credit | Preserve as unallocated review context | Distribute it without an explicit policy |
| Invalid or duplicate reversal | Exclude invalid reversal effect and surface safe error state | Cancel a valid payment or double reverse |
| Conflicting legacy sources | Mark the affected balance unavailable and record restricted diagnostics | Pick one source silently or add both |
| No transactions | Return an explicit empty state with zero only when source completeness is confirmed | Treat source failure as no balance |
| Partial page | Return page metadata; portfolio totals come from full scoped snapshot | Sum the current page and label it portfolio total |
| Future-dated records | Exclude from an earlier as-of projection and label future schedule separately | Include them in current outstanding balance |

## Risks before exposing balances

- Existing `ledgerEntries`, payment records, obligation rows, reconciliation records, and credit allocations can overlap or disagree. The normalized source precedence and deduplication contract is not yet implemented.
- The existing lease-ledger route computes signed running totals from legacy entry types; Phase 0 uses explicit transaction types and reversal lineage. Equivalence needs fixture-based proof.
- Current tenant, landlord, and generic ledger routes have different projections and fallback behavior. Reuse without an audience-specific contract risks data leakage or contradictory balances.
- A projection can be mathematically deterministic while its source snapshot is incomplete. Completeness must be a first-class output.
- Aging can be misread as legal delinquency or automated collection eligibility.
- Portfolio aggregation can amplify one bad source mapping across many leases.
- Exports can be treated as official financial statements unless their supported scope and exclusions are prominent.
- Provider payment status, reconciliation evidence, and accounting effect can diverge. Direct settlement does not remove the need for explicit evidence and source precedence.
- Historical corrections require append-safe reversals and adjustments. Recomputing or overwriting old rows would damage audit continuity.

## Non-goals

- No Rotessa integration, selection, credential, API client, webhook, polling, mapping, or provider claim.
- No PAD authorization, mandate, scheduling, initiation, retry, return handling, or cancellation.
- No payment-method collection or tenant bank data.
- No funds collection, custody, pooling, safeguarding, settlement, payout, or money movement by RentChain.
- No claim that tenant rent is RentChain revenue; tenant rent remains landlord revenue.
- No Firestore read/write implementation, migration, backfill, or schema change.
- No API route or frontend implementation.
- No ledger, payment, allocation, decision, or workflow mutation.
- No accounting export implementation.
- No general ledger, accounts payable, bank reconciliation, trust accounting, payroll, tax, expense, reserve, management-fee, or owner-distribution system.
- No legal delinquency, collection, eviction, credit-reporting, or automated outreach inference.
- No RC1 demo behavior change.

## Recommended next implementation PR

Proceed only with a backend-only **Phase 0C lease receivables read-model contract and mapper** PR. It should remain unmounted and make no Firestore or route changes.

Proposed scope:

- add versioned landlord lease receivables DTO types under `rentchain-api/src/lib/accounting/readModels`;
- add a pure assembler that accepts already normalized transactions, safe lease labels, as-of date, completeness metadata, and explicit allocation policy;
- compose the existing Phase 0 balance and aging projections without duplicating their formulas;
- translate findings through an allowlisted landlord-safe finding mapper;
- return `unavailable` rather than a numeric balance when error-severity findings affect accounting integrity;
- add deterministic fixture tests for empty, complete, partial, invalid, overpayment, reversal, and unallocated-payment cases;
- add comparison fixtures documenting how representative legacy lease-ledger rows should normalize, but do not read legacy collections yet.

Explicitly exclude the existing lease route, all UI, Firestore, exports, tenant DTOs, portfolio aggregation, and mutation. This PR is safe because it strengthens the contract at the narrowest authority boundary without changing runtime behavior. A later audit should approve the legacy-source adapter before any route mounts the DTO.

Recommended sequence after Phase 0C:

1. Legacy source-mapping and equivalence audit with representative fixtures.
2. Landlord lease read-only route behind an explicit versioned endpoint or feature gate.
3. Lease ledger UI comparison/manual QA, then summary-card reuse.
4. Rent-roll DTO and bounded route.
5. Aging report from the same snapshot.
6. Dashboard/operations summaries from canonical portfolio outputs.
7. Tenant-safe DTO and projection review.
8. Receivables statement export after reconciliation and completeness gates.

## Validation plan

For this audit PR:

- confirm the diff contains only this strategy document;
- run `git diff --check` and `git diff --cached --check`;
- scan for competitor names and remove any accidental comparisons;
- confirm no files under `rentchain-api`, `rentchain-frontend`, infrastructure, rules, or CI changed;
- confirm no runtime, payment, provider, credential, bank-data, export, or RC1 behavior changed;
- confirm the working tree is clean after commit.

For the proposed Phase 0C implementation:

- focused unit tests for DTO composition, whitelist projection, deterministic ordering, completeness, and finding translation;
- existing Phase 0 accounting tests;
- backend TypeScript production build;
- forbidden-import scan for Express, Firestore, provider, bank-data, payment-execution, and mutation dependencies;
- `git diff --check` and exact-file scope validation;
- no browser/manual QA because the module remains unmounted and has no user-visible effect.

For any later mounted route or UI:

- server-side landlord/tenant/admin boundary tests, including cross-owner denial;
- source-equivalence and incomplete-source fixtures;
- pagination and full-snapshot aggregate tests;
- empty, partial, unavailable, overpayment, reversal, and unallocated-payment states;
- desktop, reduced-desktop, mobile, print, and export review where applicable;
- explicit confirmation that reads cause no writes or workflow mutation;
- direct-settlement claim review: no wording that RentChain received, held, pooled, settled, or paid out tenant funds.

## Decision

Phase 0B should advance as a contract-first read-model program. The existing landlord lease ledger is the correct first integration boundary, but mounting Phase 0 projections there now would be premature because normalized legacy source mapping and completeness rules are not yet implemented. The safe next PR is the pure, unmounted Phase 0C lease receivables DTO assembler and its tests. Rent roll, aging, dashboard, tenant, admin/support, and export surfaces should follow only from the same reconciled source contract.
