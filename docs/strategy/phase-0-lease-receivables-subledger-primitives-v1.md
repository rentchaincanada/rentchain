# Phase 0 Lease Receivables Subledger Primitives v1

Status: backend implementation audit and plan only; no runtime accounting behavior, persistence, route, UI, payment processing, PAD behavior, or provider integration is authorized by this document

## 1. Executive Summary

RentChain should introduce a small backend-only `lib/accounting` boundary containing canonical receivable types and deterministic, side-effect-free projections before it changes any live ledger or payment behavior. The first implementation should accept normalized lease and transaction inputs, return validated charge previews and financial projections, and never read or write Firestore, call a provider, mutate a payment, expose a route, or affect RC1.

The current backend has useful but fragmented foundations:

- signed `ledgerEntries` remain the current aggregate lease-balance source;
- `paymentObligationLedger` derives obligation rows from leases, payment intents, rent payments, canonical payments, reconciliation records, and credit allocations;
- `leaseCreditAllocationService` now implements preview fingerprints, stale-state validation, idempotency, append-safe allocation records, and reversals;
- `paymentReconciliationRecords` preserves provider/payment comparison results;
- multiple lease interfaces and aliases represent rent, start/end dates, due-day fields, status, property, unit, and tenant context;
- tests already exercise date-only due-day behavior, obligation status, partial/overpayment conditions, and allocations.

These are transition inputs, not a canonical property receivables model. Phase 0 should not replace or wire into them yet. It should define a pure model that can later be mapped to existing records through a separately reviewed integration PR.

The smallest safe implementation is one backend-only PR containing:

1. canonical receivable transaction types and normalization;
2. monthly charge-schedule preview with explicit validation findings;
3. stable preview fingerprint and pure stale comparison;
4. balance, aging, and rent-roll projections;
5. focused Vitest coverage with no emulator, network, credentials, or clock dependence.

## 2. Why Phase 0 Exists Before Rotessa

Rotessa or any future payment provider can report execution attempts and external status. It cannot determine why rent is due, which lease version authorized a charge, how a payment is allocated, whether a credit exists, how a return reopens a balance, or what a property rent roll should show.

The required authority chain is:

```text
normalized approved lease terms
  -> deterministic charge preview
    -> future append-safe receivable transactions
      -> pure balance and aging projections
        -> property rent-roll projection

future provider evidence
  -> separately reconciled payment fact
    -> future explicit payment allocation/reversal
      -> same canonical receivable projections
```

If provider work begins first, provider schedules and statuses can accidentally become the rent book. Phase 0 prevents that coupling by defining accounting semantics without provider concepts, bank data, payment methods, or settlement assumptions.

Rotessa remains completely out of scope for the audit PR and the first implementation PR.

## 3. Current Backend, Payment, and Ledger Surface Inventory

### Current sources and helpers

| Area | Current implementation | Phase 0 decision |
| --- | --- | --- |
| Lease shapes | `models/lease.ts`, `types/lease.ts`, `services/leaseService.ts`, `services/leaseApi.ts`, route-local and projection-local shapes | Do not import a broad runtime lease model. Define a narrow accounting input and an explicit adapter contract for a later integration PR. |
| Aggregate balance | Signed `ledgerEntries`; charges increase balance, payments reduce it, adjustments may have either sign | Preserve current live authority. The first PR computes only from supplied canonical transaction fixtures and does not replace ledger reads. |
| Obligation read model | `lib/payments/paymentObligationLedger.ts` derives expected/paid/outstanding status from heterogeneous sources | Reuse date-only and cents lessons, but do not import provider/payment state into the new schedule generator. Future mapping is separate. |
| Credit allocation | `services/leaseCreditAllocationService.ts` plus `leaseCreditAllocationRecords` | Reuse the preview fingerprint, pure validation, idempotency, before/after, and append/reverse conventions. Do not modify the service in the first PR. |
| Provider reconciliation | `lib/payments/paymentReconciliationRecords.ts` | Out of scope. Provider evidence must not enter Phase 0 primitives. |
| Manual payment records | `payments` collection and payment routes support recording, editing, and deletion | Do not call or change these paths. A future canonical integration must replace destructive correction with append/reverse semantics. |
| Card payment records | `paymentIntents` and `rentPayments` | Not schedule authority. No dependency from `lib/accounting` to these modules. |
| Tenant ledger | Event/payment fallback paths include legacy and in-memory behavior | Not accounting authority. No dependency from the new pure model. |
| Hashing | Existing services use SHA-256 over normalized JSON and prefix fingerprints by purpose | Use SHA-256 over an explicit stable serialization contract; no new dependency or cryptographic protocol. |
| Tests | Vitest with many pure `lib/**/__tests__` suites | Add colocated pure tests runnable without Firestore or emulator state. |

### Current gaps addressed by Phase 0

- No single canonical receivable transaction taxonomy exists.
- No authoritative multi-period charge-schedule preview exists.
- Current obligation derivation generally produces a current expected row, not a versioned schedule preview.
- Lease field aliases and money units are inconsistent across models.
- There is no pure canonical balance projection covering credits, applied payments, reversals, write-offs, and overpayment.
- There is no pure property rent-roll projection sourced from canonical lease-account inputs.
- There is no reusable date-only aged-receivables projection with exact boundary tests.
- There is no accounting-specific preview fingerprint contract.

### Existing behavior that must not change

- `GET /api/leases/:leaseId/ledger` and its calculations.
- Credit-allocation routes, records, projections, and stale error behavior.
- Payment routes, payment-intent state, rent-payment state, reconciliation, or exports.
- Dashboard, operations, tenant, landlord, admin, or support projections.
- RC1 demo data, routes, labels, and workflows.

## 4. Proposed Canonical Receivable Transaction Model

### Module boundary

Suggested initial module:

```text
rentchain-api/src/lib/accounting/
  receivableTypes.ts
  chargeSchedulePreview.ts
  receivableProjections.ts
  index.ts
  __tests__/
```

Every exported function must be pure. The module must not import Firebase, Express, provider adapters, payment services, route types, environment configuration, or wall-clock helpers.

### Transaction types

```ts
export type ReceivableTransactionType =
  | "scheduled_rent_charge"
  | "deposit_charge"
  | "one_time_charge"
  | "credit"
  | "adjustment"
  | "payment_applied"
  | "payment_reversal"
  | "write_off"
  | "nsf_fee";
```

`nsf_fee` is a modeled possibility only. Its presence in a type union does not enable a fee, policy, route, or user action. Late fees should not be added to the first union unless a later policy mission defines their distinct treatment. Both are jurisdiction-sensitive and require explicit enablement outside Phase 0.

### Canonical transaction shape

```ts
export type ReceivableTransaction = {
  transactionId: string;
  leaseId: string;
  propertyId: string;
  unitId: string | null;
  responsibilityId: string | null;
  tenantId: string | null;

  type: ReceivableTransactionType;
  amountCents: number;
  currency: "cad";
  effectiveDate: string; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD for charge-like rows
  periodStart: string | null;
  periodEnd: string | null;

  sourceRef: string | null;
  sourceVersion: string | null;
  reversesTransactionId: string | null;
  metadata: {
    policyKey?: string;
    scheduleOccurrenceKey?: string;
  };
};
```

The first PR should define and normalize data, not generate canonical IDs for persisted records. Test IDs and schedule occurrence keys are deterministic correlation values; a future persistence mission decides document IDs.

### Amount and balance semantics

All stored model amounts are positive integer cents except `adjustment`, which requires an explicit direction rather than a signed amount:

```ts
type ReceivableAdjustmentDirection = "increase" | "decrease";
```

Projection effects:

| Type | Receivable effect | Rule |
| --- | ---: | --- |
| `scheduled_rent_charge` | `+amount` | Charge generated from an approved schedule occurrence. |
| `deposit_charge` | `+amount` | Contractual amount due only; no claim that RentChain holds a deposit. |
| `one_time_charge` | `+amount` | Requires an external approved source/policy in future runtime use. |
| `credit` | `-amount` | Reduces receivable; does not imply cash movement. |
| `adjustment` | `+/-amount` | Direction is mandatory and reason/policy belongs to a future append workflow. |
| `payment_applied` | `-amount` | Represents an already approved allocation fact, not provider success or money movement. |
| `payment_reversal` | `+amount` | Reopens receivable and must reference the applied transaction being reversed. |
| `write_off` | `-amount` | Accounting decision only; not forgiveness, legal conclusion, or payment. |
| `nsf_fee` | `+amount` | Model-only and rejected unless an explicit policy-enabled input is supplied in a future phase. Initial normalization should mark it restricted. |

The balance projector should expose both signed net balance and split display values:

```ts
type ReceivableBalanceProjection = {
  chargeCents: number;
  creditCents: number;
  appliedPaymentCents: number;
  reversalCents: number;
  writeOffCents: number;
  adjustmentIncreaseCents: number;
  adjustmentDecreaseCents: number;
  netBalanceCents: number;
  outstandingCents: number;
  overpaymentCents: number;
  transactionCount: number;
  findings: ReceivableFinding[];
};
```

```text
outstandingCents = max(0, netBalanceCents)
overpaymentCents = max(0, -netBalanceCents)
```

The projector must not mutate inputs or infer missing reversals. Duplicate IDs, invalid dates, non-integer/negative amounts, unsupported currency, missing scope, self-reversal, and mismatched reversal amount should produce deterministic validation findings. The recommended first PR should fail closed and exclude invalid rows from totals rather than silently coercing them.

### Append-safe semantics

- A historical row is never edited or deleted by these primitives.
- A reversal is a new row linked through `reversesTransactionId`.
- A transaction can be actively reversed only once in the supplied projection set.
- A reversal must match lease, property, currency, and amount of its target in the first implementation.
- `payment_applied` represents allocation, not receipt or settlement evidence.
- `payment_reversal` reverses only `payment_applied` in the first implementation.
- A write-off does not erase charge history and does not create a payment.

## 5. Proposed Charge-Schedule Preview Model

### Narrow normalized input

```ts
export type LeaseChargeScheduleInput = {
  leaseId: string;
  propertyId: string;
  unitId: string | null;
  responsibilityId: string | null;
  tenantId: string | null;
  sourceLeaseVersion: string;
  leaseStartDate: string; // YYYY-MM-DD
  leaseEndDate: string | null; // inclusive date
  monthlyRentCents: number;
  dueDay: number; // 1..31
  currency: "cad";
  billingFrequency: "monthly";
  depositAmountCents?: number | null;
  asOfDate: string; // explicit deterministic horizon anchor
  previewThroughDate: string; // required bounded horizon
};
```

The input is intentionally narrower than existing lease interfaces. A future adapter maps aliases such as `rent`, `monthlyRent`, `startDate`, `leaseStartDate`, `nextChargeDay`, `dueDay`, or nested schedules. The pure schedule function must not guess aliases.

`responsibilityId` may be null only when responsibility is not yet modeled and the preview is explicitly lease-level. The output must include a `responsibility_not_modeled` finding so it cannot later be mistaken for tenant-specific debt.

### Preview output

```ts
export type LeaseChargeSchedulePreview = {
  allowed: boolean;
  normalizedInput: LeaseChargeScheduleInput | null;
  occurrences: LeaseChargeOccurrence[];
  totals: {
    scheduledRentCents: number;
    depositChargeCents: number;
    occurrenceCount: number;
  };
  findings: ReceivableFinding[];
  previewFingerprint: string;
};
```

Each occurrence should include:

- deterministic `occurrenceKey` from lease, responsibility, source version, type, due date, period, amount, and currency;
- transaction type;
- amount/currency;
- due date;
- period start and period end as date-only values;
- source lease version;
- a boolean `policyReviewRequired` only for modeled restricted categories.

### Monthly schedule rules for the first implementation

1. Parse only strict `YYYY-MM-DD` calendar dates.
2. Use UTC calendar arithmetic internally so server timezone and daylight saving do not change results.
3. Support only `monthly` billing.
4. Clamp due day to the last valid day of short months.
5. Generate the first monthly occurrence in the lease-start month when its due day is on or after the lease start date; otherwise start in the next month.
6. Treat `leaseEndDate` as inclusive and do not generate a due date after it.
7. Bound generation by `previewThroughDate` and a fixed maximum occurrence count to prevent accidental unbounded work.
8. Use the full monthly rent amount. Do not prorate a partial first or last month in the first implementation.
9. Emit `proration_policy_required` when the lease begins after the configured due day or ends before the last covered monthly period, so a caller cannot mistake a full-month preview for approved proration.
10. If `depositAmountCents` is positive, emit one `deposit_charge` occurrence due on the lease start date, clearly separate from rent.
11. Reject zero/negative/non-integer rent, invalid dates, end before start, invalid due day, unsupported currency/frequency, or an excessive horizon.
12. Sort occurrences by due date, transaction-type order, and occurrence key.

The schedule preview creates no receivable transaction in storage and has no apply function in the first PR.

## 6. Proposed Deterministic Balance Projection

### Function

```ts
projectReceivableBalance(
  transactions: readonly ReceivableTransaction[],
  scope?: { leaseId?: string; propertyId?: string; asOfDate?: string }
): ReceivableBalanceProjection
```

Rules:

- copy and deterministically sort inputs; never sort the caller's array in place;
- include only rows within the requested canonical scope;
- if `asOfDate` is provided, exclude later effective dates and report them separately only if useful to tests;
- validate transaction identity and reversal lineage before totals;
- sum integer cents only;
- do not inspect payment-provider status;
- do not equate pending, initiated, authorized, or scheduled payment state with `payment_applied`;
- return findings in stable code/transaction order.

Required scenarios:

- charge only;
- charge plus full/partial applied payment;
- multiple charges and one applied amount represented as explicit transaction inputs;
- credit;
- increase/decrease adjustment;
- payment reversal;
- write-off;
- overpayment;
- invalid/duplicate/reversal mismatch excluded with findings;
- empty transaction set.

## 7. Proposed Rent-Roll Projection

### Input and output

The rent roll should compose already normalized lease descriptors and balance/aging results. It must not query properties, tenants, payments, or Firestore.

```ts
export type RentRollLeaseInput = {
  propertyId: string;
  propertyLabel: string;
  unitId: string | null;
  unitLabel: string;
  leaseId: string;
  responsibilityId: string | null;
  tenantDisplayName: string | null;
  leaseStatus: "active" | "signed_future" | "notice_period" | "ended" | "unknown";
  scheduledRentCents: number;
  currency: "cad";
  nextDueDate: string | null;
  transactions: readonly ReceivableTransaction[];
};
```

```ts
export type RentRollProjection = {
  asOfDate: string;
  rows: RentRollRow[];
  propertySummaries: RentRollPropertySummary[];
  portfolioSummary: RentRollPortfolioSummary;
  findings: ReceivableFinding[];
};
```

Each row may contain the requested property, unit, tenant label, lease status, scheduled rent, current balance, next due date, and aging bucket summary. It must not expose raw internal IDs as display labels; IDs remain internal correlation fields while caller-supplied labels remain separate.

Rules:

- require explicit `asOfDate`;
- derive balance and aging by calling pure projectors, not duplicating math;
- sort rows by property label, unit label, tenant label, then lease ID as an internal stable tie-breaker;
- aggregate only rows with valid cents/currency/scope;
- preserve `unknown` and missing-label findings rather than inventing names;
- do not classify ended leases as collectible or write them off automatically;
- do not produce collection, enforcement, or risk recommendations.

## 8. Proposed Aging Projection

### Buckets

```ts
export type ReceivableAgingBucket =
  | "current"
  | "days_1_30"
  | "days_31_60"
  | "days_61_90"
  | "days_90_plus";
```

Suggested output:

```ts
export type ReceivableAgingProjection = {
  asOfDate: string;
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
  totalOutstandingCents: number;
  chargeRows: ReceivableAgingRow[];
  findings: ReceivableFinding[];
};
```

### Allocation input requirement

Aging cannot be correct from aggregate net balance alone. The function must receive charge-level remaining amounts or a deterministic allocation input. The first implementation should use explicit charge allocation references when present and otherwise apply a documented projection-only policy, such as oldest-due-first, only when the caller explicitly selects it.

Recommended first PR behavior:

- derive open charge amounts from charge-like transactions;
- apply `credit`, `payment_applied`, `write_off`, and valid reversals oldest-due-first for projection purposes;
- label the result `projection_allocation_policy: oldest_due_first`;
- keep this projection policy separate from durable business allocation facts;
- never create or imply a stored allocation.

If that policy risks confusing projection with authority, the implementation may instead require explicit `appliesToTransactionId` on every reducing row and return `allocation_required` for unapplied amounts. The implementation review should prefer explicit linkage for correctness and use oldest-due-first only for a clearly labeled aggregate preview.

### Date-only rules

- Parse only strict `YYYY-MM-DD`.
- Normalize `asOfDate` and due dates to UTC calendar-day ordinals.
- `current`: due today or in the future (`daysPastDue <= 0`).
- `days_1_30`: 1 through 30 days past due, inclusive.
- `days_31_60`: 31 through 60, inclusive.
- `days_61_90`: 61 through 90, inclusive.
- `days_90_plus`: 91 or more days past due.

Tests must cover 0, 1, 30, 31, 60, 61, 90, and 91 days; month/year/leap-day boundaries; and identical results under different process timezones.

Aging is accounting classification only. It must not trigger reminders, notices, late fees, NSF fees, collection actions, lease changes, or legal conclusions.

## 9. Preview Fingerprint and Stale-State Protection

### Existing pattern to reuse

`leaseCreditAllocationService` currently constructs a normalized fingerprint input, orders allocation facts and obligations, hashes `JSON.stringify` output with SHA-256, prefixes the result by purpose, and compares the submitted fingerprint against a freshly derived preview. It returns `CREDIT_ALLOCATION_STATE_STALE` on mismatch.

The accounting module should use the same conceptual pattern without importing the Firestore-backed service.

### Stable serialization contract

The fingerprint input should be an explicitly constructed object with keys in code-defined order:

```ts
{
  schemaVersion: "lease_charge_schedule_preview_v1",
  leaseId,
  propertyId,
  unitId,
  responsibilityId,
  tenantId,
  sourceLeaseVersion,
  leaseStartDate,
  leaseEndDate,
  monthlyRentCents,
  dueDay,
  currency,
  billingFrequency,
  depositAmountCents,
  asOfDate,
  previewThroughDate,
  occurrences: normalizedAndSortedOccurrences,
  findings: sortedFingerprintRelevantFindingCodes,
}
```

Undefined values must be converted to explicit `null` or omitted by a fixed rule before hashing. Arrays must be sorted by canonical keys. Human display labels and transient error messages must not enter the fingerprint.

Suggested format:

```text
lease_charge_schedule_preview:v1:<32-or-64-lowercase-hex-digest>
```

A 32-character truncated SHA-256 digest matches current internal patterns and is sufficient as a stale-state token, not as a signature. The schema version and full normalized input are more important than digest length.

### Pure stale comparison

```ts
validateChargeSchedulePreviewFingerprint({
  expectedPreviewFingerprint,
  currentPreview,
}):
  | { ok: true }
  | { ok: false; code: "RECEIVABLE_SCHEDULE_STATE_STALE" };
```

Tests must prove:

- identical semantic inputs produce identical fingerprints;
- object construction or optional-field noise cannot change the normalized result;
- changed rent, dates, due day, deposit, responsibility, lease version, currency, frequency, horizon, occurrence, or relevant finding changes the fingerprint;
- reordered input collections normalize to the same fingerprint where order is not semantic;
- missing or mismatched expected fingerprint fails closed.

There is no apply endpoint or persistence step in the first PR. This validation exists so a future preview/apply mission can reuse the contract.

## 10. Test Strategy

### Test location

Suggested suites:

```text
rentchain-api/src/lib/accounting/__tests__/receivableTypes.test.ts
rentchain-api/src/lib/accounting/__tests__/chargeSchedulePreview.test.ts
rentchain-api/src/lib/accounting/__tests__/receivableProjections.test.ts
```

### Required coverage

#### Type normalization

- every supported transaction type;
- restricted `nsf_fee` finding;
- integer cents and CAD normalization;
- invalid type, currency, amount, date, scope, direction, and reversal linkage;
- no input mutation.

#### Schedule preview

- standard 12-month lease;
- open-ended lease bounded by preview-through date;
- due day before/on/after lease start;
- due day 29/30/31 across short months and leap year;
- inclusive lease end;
- deposit occurrence;
- non-prorated partial first/last period findings;
- invalid/unsupported inputs fail closed;
- stable ordering and maximum horizon.

#### Fingerprint

- same normalized input, same digest;
- each material input change changes digest;
- null/undefined normalization;
- stale/missing fingerprint rejection.

#### Balance

- charge, credit, increase/decrease adjustment;
- partial and full applied payment;
- multiple charges;
- valid payment reversal;
- write-off;
- overpayment split;
- invalid and duplicate rows;
- reversal mismatch and duplicate reversal;
- scope/as-of filtering.

#### Aging

- exact 0/1/30/31/60/61/90/91 boundaries;
- future due date;
- leap day, month-end and year-end;
- partial open charge;
- payment reversal reopening a bucket;
- overpayment excluded from aged receivable;
- explicit or projection-only allocation behavior;
- deterministic timezone-independent results.

#### Rent roll

- one and multiple properties/units/leases;
- row and property/portfolio totals;
- active, future, notice, ended, and unknown states preserved;
- missing display labels produce findings without exposing IDs as labels;
- stable sorting;
- no collections/enforcement output.

### Commands for the future implementation PR

From `rentchain-api` with Node 20:

```bash
npx vitest run src/lib/accounting/__tests__ --pool=forks --minWorkers=1 --maxWorkers=2
npm run build
```

Repository validation:

```bash
git diff --check
git diff --cached --check
```

The focused tests must not need Firestore, an emulator process, environment credentials, Rotessa, Stripe, or network access.

## 11. Non-Goals

- Rotessa integration, calls, adapter, credentials, customer mapping, or provider status.
- PAD authorization, mandate, scheduling, debit, cancellation, retry, or webhook behavior.
- Tenant bank information or payment-method collection.
- Live payment recording, editing, deletion, allocation, settlement, or mutation.
- Firestore reads, writes, collections, indexes, migrations, or rules.
- Public, landlord, tenant, admin, support, job, or webhook routes.
- Frontend UI, route, copy, layout, demo data, or API-client changes.
- Production accounting export, owner statement, close, journal, or general ledger.
- Late-fee or NSF-fee enablement; they remain policy-sensitive modeled possibilities only.
- Collections, enforcement, reminder, notice, legal, tax, custody, safeguarding, or compliance claims.
- Modification of existing ledger, obligation, credit-allocation, payment, reconciliation, or evidence behavior.
- RC1 demo behavior changes.

## 12. Implementation Phases for Codex

### Phase 0A — Types and pure model definitions

- Add the `lib/accounting` module boundary.
- Define transaction, finding, schedule, balance, aging, and rent-roll types.
- Implement strict normalization and validation.
- Model `nsf_fee` as restricted only; do not enable policy.

Acceptance: TypeScript types compile; normalization is deterministic; no runtime dependency enters the module.

### Phase 0B — Deterministic charge-schedule preview

- Implement strict date-only helpers and bounded monthly occurrence generation.
- Support explicit deposit preview.
- Emit findings for proration/policy ambiguity.
- Add no apply function, storage, route, or provider behavior.

Acceptance: identical normalized input returns identical sorted occurrences and totals.

### Phase 0C — Fingerprint and stale-state protection

- Construct a versioned canonical fingerprint payload.
- Hash with Node SHA-256 using the existing internal convention.
- Add pure missing/mismatch validation with `RECEIVABLE_SCHEDULE_STATE_STALE`.

Acceptance: material input changes alter the fingerprint; semantic equality preserves it.

### Phase 0D — Pure balance projection

- Apply explicit transaction effects.
- Validate reversal lineage and scope.
- Return split totals, outstanding, overpayment, and findings.

Acceptance: no mutation, provider status, persistence, or hidden payment inference.

### Phase 0E — Pure rent-roll projection

- Compose normalized lease descriptors with balance/aging projections.
- Aggregate property and portfolio totals.
- Preserve labels separately from internal IDs.

Acceptance: deterministic rows and totals without reads or routes.

### Phase 0F — Aging projection

- Implement date-only day differences and exact aging buckets.
- Use explicit allocation links where possible; clearly label any preview allocation policy.
- Keep aging informational and non-operational.

Acceptance: all boundary and timezone tests pass.

### Phase 0G — Focused test suite

- Add the required pure Vitest suites.
- Run targeted tests and backend TypeScript build under Node 20.
- Confirm no emulator/provider/network dependency.

Acceptance: targeted tests and build pass; diff checks pass.

### Phase 0H — Implementation handoff

- Report exact files and exported contracts.
- Document unsupported frequency/proration/policy cases.
- Confirm no route, UI, Firestore, payment, provider, or RC1 change.
- Recommend a separate integration audit before any existing runtime service consumes the primitives.

## 13. Recommended First Implementation PR

Branch:

```text
backend/phase-0-receivables-subledger-primitives-v1
```

Recommended exact scope:

```text
rentchain-api/src/lib/accounting/receivableTypes.ts
rentchain-api/src/lib/accounting/chargeSchedulePreview.ts
rentchain-api/src/lib/accounting/receivableProjections.ts
rentchain-api/src/lib/accounting/index.ts
rentchain-api/src/lib/accounting/__tests__/receivableTypes.test.ts
rentchain-api/src/lib/accounting/__tests__/chargeSchedulePreview.test.ts
rentchain-api/src/lib/accounting/__tests__/receivableProjections.test.ts
```

The PR should implement Phases 0A–0G as one cohesive pure-library increment because each projection depends on the same normalized types and date semantics. If review size grows beyond a focused PR, split after schedule/fingerprint, then add projections in a second backend-only PR; do not compensate by weakening tests.

Explicitly excluded files:

- all route files;
- all frontend files;
- Firebase/Firestore services, rules, and indexes;
- current ledger/payment/allocation/reconciliation services;
- provider, billing, auth, entitlement, infrastructure, and deployment files.

After this implementation, the next mission should be an audit-only mapping plan from existing lease and ledger sources into the pure input contracts. It should not immediately wire production routes.

## 14. Risks and Guardrails

| Risk | Guardrail |
| --- | --- |
| New types are mistaken for live accounting authority | Keep module unmounted and route-free; document it as a pure foundation until a separate integration approval. |
| Lease alias ambiguity enters core math | Accept one narrow normalized input; future adapters own legacy-field resolution. |
| Dollars/cents confusion | Use fields suffixed `Cents`, require integers, and reject ambiguous values. |
| Date/timezone drift | Strict date-only format and UTC calendar arithmetic; explicit `asOfDate` and horizon. |
| Unbounded open-ended lease generation | Required preview-through date plus maximum occurrence count. |
| Proration is guessed | Full-month preview only with `proration_policy_required`; no silent proration. |
| Deposit is represented as held funds | Label only as contractual `deposit_charge`; no custody/settlement field or claim. |
| Payment state is inferred from provider status | No provider/payment-service imports; `payment_applied` must be an explicit supplied accounting fact. |
| Aggregate reductions distort aging | Prefer explicit charge linkage; label any oldest-due-first behavior as projection-only. |
| Restricted fees become enabled | `nsf_fee` returns a restricted-policy finding and has no generator or UI. |
| Reversal deletes history | Reversal is a separate linked row; input remains immutable. |
| Fingerprint gives false security | Treat digest only as a stale token; schema version and re-derived normalized state are authoritative. |
| Internal IDs leak as labels | Rent-roll inputs separate IDs and display labels; missing labels remain missing. |
| Existing live math changes accidentally | Do not import or modify current ledger, obligation, allocation, payment, or route modules. |
| RC1 regression | No runtime consumer, route, UI, fixture, or demo change. Manual preview QA is not required for the audit or pure-library PR. |

## 15. RC1/RC2 Boundary

RC1 remains signed off and unchanged. Its landlord demo continues to use the already validated ledger and workflow surfaces without claims of full property accounting or PAD automation.

The docs-only audit is RC2 preparation. The recommended pure backend library is also an RC2 foundation, but it is not a live accounting rollout. Existing runtime code should consume it only through a later, separately audited migration/integration plan with source reconciliation and regression coverage.

Rotessa, PAD authorization, scheduled debits, provider status, bank data, reconciliation, accounting exports, and production money movement remain later gated work.
