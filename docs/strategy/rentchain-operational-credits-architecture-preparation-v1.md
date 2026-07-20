# RentChain Operational Credits Architecture Preparation v1

Status: planning and architecture preparation only
Decision posture: no implementation, customer balance, grant, purchase, reservation, redemption, Certn transaction, or production claim is approved by this document

## 1. Executive summary

RentChain Operational Credits should be designed as an organization-scoped, ledger-backed service entitlement system. It must remain separate from subscription access, rent and deposit accounting, payment processing, and the existing lease-credit-allocation workflow. A credit is a non-cash right to consume an eligible RentChain or partner service under configured terms; it is not currency, stored value, a tenant deposit, a transferable asset, or RentChain-held money.

The current platform has useful foundations but no Operational Credits system. It has subscription plans and capability entitlements, pay-per-use screening monetization, provider-neutral screening workflow components, organization/landlord scope patterns, append-safe audit patterns, and administrative surfaces. It does not have an organization credit account, immutable service-credit ledger, reservation/redemption protocol, service catalogue, campaign engine, balance reconciliation, or approved Certn adapter.

The smallest safe first production slice is not a promotion and not a customer balance card. After commercial, legal, accounting, privacy, security, and provider approvals, the first implementation should establish neutral service-catalogue contracts and a pure, unmounted ledger domain core with deterministic projections and tests. Persistence, protected administration, subscription grants, screening redemption, and customer UI should follow in separate reviews.

## 2. Terminology and hard boundaries

Customer-facing working name: **RentChain Operational Credits**.

Neutral internal terms:

- `service_credit`
- `platform_credit`
- `operational_unit`
- `credit_account`
- `credit_ledger_entry`
- `service_catalogue_item`

Prohibited representations:

- cryptocurrency, token, coin, wallet, exchange, investment, or appreciating asset;
- cash, refundable deposit, tenant deposit, rent payment, trust money, or bank balance;
- transferable property, peer-to-peer value, externally tradeable value, or withdrawable funds;
- a promise that one credit always buys one report;
- a promise that Certn or any future provider is live before implementation and approval.

The existing `leaseCreditAllocationRecords` workflow applies aggregate lease payment credit to rent obligations. It concerns landlord receivables and tenant payment evidence. Operational Credits concern service consumption by a customer organization. The two domains must not share accounts, balances, ledger entries, APIs, labels, or reconciliation rules.

## 3. Current-state platform audit

### 3.1 Surface inventory and workflow findings

| Surface | Current-state finding | Future Operational Credit relevance | Current claim boundary |
| --- | --- | --- | --- |
| Signup and authentication | Firebase-authenticated roles include landlord, admin, tenant, and contractor; server middleware resolves landlord context. | A future account must be created only after canonical organization ownership is established, never from client-supplied scope. | Do not promise signup credits. |
| Pricing | Public plans are Free, Starter, Pro, and Elite with monthly/yearly presentation; Enterprise pricing is strategic/custom. | Annual-plan incentives could be displayed after configuration, legal review, and a real grant path exist. | Do not add quantities, retail value, or annual-credit claims now. |
| Subscription and billing | Capability entitlements and Stripe-backed subscription/payment paths exist; screening remains pay-per-use. | Subscription entitlement events may later trigger idempotent credit grants through a separate adapter. | Subscription access and credits remain distinct. |
| Dashboard | Landlord dashboard summarizes operational work and decision queues. | Later location for a compact organization balance and expiring-credit notice. | No balance or activation card until authoritative APIs exist. |
| Properties and units | Landlord-scoped property/unit records support onboarding and workflow context. | First property/unit milestones may become eligibility evidence, not direct grants. | Creation must not silently mint credits. |
| Applications | Applications lead into review, screening, and lease follow-through. | Primary future entry into screening redemption confirmation and insufficient-credit handling. | No implied included screening. |
| Tenant screening | Provider-neutral workflow components, screening orders/history, consent, pay-per-use pricing, checkout, webhook, and TransUnion-oriented reporting paths exist. | Best initial redemption candidate after catalogue, ledger, reservation, provider, consent, and reconciliation gates. | Certn is not established as the current production path by this audit. |
| Application review | Review summary supports status-aware review and screening context. | May show service-consumption evidence after redemption, never raw partner or ledger internals. | Credits must not influence screening decisions. |
| Leasing and lease ledger | Lease summary/ledger and append-safe allocation patterns exist. | Possible future service catalogue entry for approved signing or document services. | Never mix Operational Credits with rent, deposits, payment balances, or lease credit allocation. |
| Maintenance | Maintenance and work-order workflows are landlord/tenant visible. | Future partner-service redemption candidate for approved contractor or inspection offerings. | Core maintenance workflows must not become credit-gated by default. |
| Contractors and marketplace | Contractor directory, assignment, and contractor portal surfaces exist. | Future catalogue/service-provider integration point with scoped quotes and settlement outside the credit ledger. | Credits must not imply contractor payment or custody. |
| Unified Inbox and notifications | Role-scoped communication and notification surfaces exist. | Later delivery channels for reservation expiry, completed redemption, reversal, and expiring-credit notices. | No notification until the underlying event is authoritative. |
| AI-assisted workflows | AI summaries and decision support are capability-gated and supervised. | AI may later explain eligible services or exceptions from safe projections. | AI must not grant, reserve, redeem, reverse, or adjust credits autonomously. |
| Admin tools | Admin audit, observability, integrity, screening usage, and support surfaces exist. | Future protected exception review, reconciliation, and adjustment workspace. | Existing admin access is not automatic authorization for credit mutation. |
| Institutional exports | Export and evidence patterns emphasize whitelisting, redaction, and auditability. | Future credit usage/reconciliation exports should use separate safe projections. | No raw account IDs, idempotency keys, provider payloads, or internal paths. |
| Organization and staff permissions | Current code commonly scopes to `landlordId`; staff/delegated roles exist in parts of the platform. | Credits require a canonical organization boundary, member roles, limits, and approval thresholds. | Do not treat a user ID or alias as permanent organization authority. |

### 3.2 Where users first encounter screening

Screening appears in the public/demo and authenticated application workflows, unit screening routes, application review, tenant consent/start/status flows, verified-screening views, and admin screening operations. Current plan copy describes screening as pay-per-use across tiers. The application-to-screening transition is the most natural future redemption point because it already has an application, subject, consent state, package choice, price/quote context, and provider workflow.

### 3.3 Conversion and activation opportunities

Potential annual-plan incentive placement, only after approval:

1. pricing comparison after an annual interval is selected;
2. billing upgrade confirmation before checkout;
3. post-checkout onboarding plan;
4. guided setup when the first eligible screening workflow becomes available;
5. renewal review with a separately approved renewal grant.

Potential activation evidence:

- organization setup completed;
- first property created;
- first unit created or imported;
- application form configured;
- first valid application received;
- staff invitation accepted;
- screening consent completed.

Milestones should produce append-safe eligibility evidence. A separate policy evaluation and approved grant operation should decide whether credits are granted. UI events alone must never mint credits.

### 3.4 Variable-cost services found

Existing or plausible variable-cost categories include screening/provider services, identity verification, payment processor activity, email delivery, document/storage/export processing, and external contractor/partner services. Presence of code or a workflow does not establish an approved cost, wholesale contract, or credit eligibility. Each catalogue item needs an approved commercial version before redemption is enabled.

### 3.5 Current-state workflow map

```text
Signup/authentication
  -> landlord-scoped account and plan
  -> property/unit setup
  -> application intake
  -> application review
  -> consent and screening request
  -> pay-per-use quote/checkout where supported
  -> provider workflow and screening evidence
  -> application decision
  -> lease workflow

Parallel operating paths:
  dashboard -> operations/decision work -> unified inbox/notifications
  lease -> tenant portal / ledger / notices
  maintenance -> work order -> contractor
  admin -> audit / screening usage / integrity / support

Missing Operational Credits path:
  approved entitlement or campaign
  -> organization credit account
  -> immutable grant ledger entry
  -> available-balance projection
  -> service request
  -> reservation
  -> provider transaction
  -> redemption or reversal
  -> reconciliation and safe history
```

### 3.6 Gap analysis

| Capability | Current foundation | Gap before production |
| --- | --- | --- |
| Organization balance | Landlord scoping patterns | Canonical organization account and membership authority |
| Ledger | Accounting and audit patterns | Dedicated immutable service-credit ledger and projection |
| Entitlement grants | Plan/capability metadata | Versioned policy evaluation and idempotent grant adapter |
| Screening consumption | Pay-per-use/provider workflows | Reservation-redemption boundary and catalogue pricing in units |
| Provider portability | Provider-neutral screening components | General service-provider/redemption adapter contract |
| Campaigns | No general credit campaign authority | Eligibility, caps, stacking, funding, expiry, and abuse controls |
| Onboarding | Setup steps and records | Durable milestone evidence and one-time grant prevention |
| Administration | Protected admin surfaces | Dedicated least-privilege adjustment/reversal permissions and approvals |
| Enterprise allocation | Staff/delegated patterns | Pool hierarchy, budgets, limits, cost centres, and approval rules |
| Reconciliation | Screening/payment evidence patterns | Credit-ledger-to-service-to-partner triple reconciliation |
| Customer UX | No balance/history surface | Safe DTOs and approved language after authoritative backend exists |

## 4. Operational Credits strategy

Operational Credits should be a reusable service-access layer above subscriptions:

```text
subscription and contract entitlement
  -> eligibility policy
  -> credit grant
  -> organization pool
  -> optional allocation/budget
  -> service reservation
  -> partner or internal fulfilment
  -> redemption/reversal
  -> reconciliation and reporting
```

Strategic principles:

- reward activation and retention without creating a cash-equivalent promise;
- price services in configurable credit quantities;
- keep provider wholesale cost and customer credit quantity versioned but separate;
- allow promotional, purchased, subscription-included, renewal, referral, partner-funded, enterprise, and administrative sources without changing ledger mechanics;
- make every mutation attributable, idempotent, append-only, and reversible through compensating entries;
- use a reconciled projection for fast reads; never use a mutable balance as the only truth;
- preserve a path to multiple providers and services without coupling the core engine to Certn.

## 5. Domain model

### 5.1 Aggregate boundaries

**Credit account** — one canonical account for an organization and credit programme/currency version. It defines scope and status, not a freely mutable balance.

**Credit ledger entry** — immutable signed movement of operational units. Entries are appended; corrections use linked compensating entries.

**Credit grant** — approved source and policy evidence for issuing units. A grant results in one or more ledger entries.

**Credit reservation** — time-bounded hold against available units for a specific service request. It prevents concurrent spending but is not a completed redemption.

**Credit redemption** — final consumption associated with valid fulfilment evidence.

**Credit reversal/refund** — compensating restoration associated with a failed, cancelled, or refunded fulfilment. It never edits the original redemption.

**Credit expiration** — policy-driven removal of eligible unreserved units from a particular grant lot, with immutable evidence.

**Service catalogue item** — versioned definition of an eligible service, required units, fulfilment/provider policy, availability, and reversal rules.

**Partner funding source** — approved commercial source for subsidized units, separate from provider settlement.

**Promotion/campaign** — versioned eligibility and grant policy with dates, segments, caps, stacking, and abuse controls.

**Subscription entitlement** — evidence that a plan/contract event is eligible for a configured grant; it is not the grant itself.

**Administrative adjustment** — protected, reasoned, reviewed grant or debit using append-only entries and elevated permission.

### 5.2 Credit types and entry directions

Suggested credit types:

- `promotional`
- `purchased`
- `subscription_included`
- `annual_renewal`
- `referral`
- `partner_funded`
- `enterprise_allocation`
- `administrative`

Suggested ledger event types:

- `grant`
- `reserve`
- `release_reservation`
- `redeem`
- `reverse_redemption`
- `refund`
- `expire`
- `adjustment_credit`
- `adjustment_debit`
- `allocate_to_budget`
- `return_from_budget`

Reservations should be represented explicitly and included in availability projection. They should not masquerade as permanent debit entries.

## 6. Proposed database schema

Collection names are proposed, not approved runtime schema.

### 6.1 `operationalCreditAccounts`

```ts
type OperationalCreditAccount = {
  accountId: string;
  organizationId: string;
  programmeKey: "rentchain_operational_credits";
  programmeVersion: string;
  unitCode: "operational_unit";
  status: "pending" | "active" | "suspended" | "closed";
  createdAt: string;
  createdBy: string;
  version: number;
};
```

No `balance` field is authoritative. A projection may store reconciled totals with a source cursor/fingerprint.

### 6.2 `operationalCreditLedgerEntries`

```ts
type OperationalCreditLedgerEntry = {
  entryId: string;
  accountId: string;
  organizationId: string;
  actorId: string;
  actorRole: string;
  amountUnits: number; // positive integer
  direction: "credit" | "debit" | "hold" | "release";
  entryType: string;
  creditType: string;
  sourceType: string;
  sourceId: string | null;
  reasonCode: string;
  reasonNote: string | null;
  serviceCatalogueItemId: string | null;
  serviceCatalogueVersion: string | null;
  workflowType: string | null;
  workflowRecordId: string | null;
  partnerId: string | null;
  campaignId: string | null;
  grantId: string | null;
  reservationId: string | null;
  redemptionId: string | null;
  reversesEntryId: string | null;
  occurredAt: string;
  recordedAt: string;
  idempotencyKey: string;
  policyVersion: string;
  auditMetadata: {
    requestId: string | null;
    correlationId: string | null;
    approvalRecordId: string | null;
    sourceFingerprint: string;
  };
};
```

The listed identifiers are internal references and must not be projected as customer-facing labels.

### 6.3 Supporting collections

| Collection | Purpose |
| --- | --- |
| `operationalCreditGrants` | Grant source, lot, expiry, funding, eligibility, and approval evidence |
| `operationalCreditReservations` | Active/released/consumed/expired holds with service-request fingerprint |
| `operationalCreditRedemptions` | Fulfilment lifecycle and linkage to provider transaction |
| `operationalCreditBalanceProjections` | Reconciled account and lot totals with cursor, version, and fingerprint |
| `operationalServiceCatalogueItems` | Versioned service definitions and credit quantities |
| `operationalCreditCampaigns` | Eligibility, caps, stacking, funding, dates, and disclosure version |
| `operationalCreditEntitlementEvents` | Subscription/contract evidence consumed idempotently by grants |
| `operationalCreditPartnerTransactions` | Provider request, status, cost evidence, and reconciliation linkage |
| `operationalCreditReconciliationEvents` | Append-safe mismatch, resolution, and reviewer evidence |
| `operationalCreditBudgets` | Optional enterprise allocation, limits, period, cost centre, and approvers |
| `operationalCreditOnboardingSessions` | Milestone evidence and activation evaluation state |

Indexes should be designed from exact queries. Likely keys include organization/account plus recorded time, idempotency key, active reservation expiry, grant expiry, workflow fingerprint, partner transaction reference, and reconciliation status. Index and Firestore-rule changes require separate approval.

## 7. Ledger integrity rules

1. Entries are immutable and append-only.
2. All amounts are positive integers; direction and entry type determine signed effect.
3. Every mutation has a globally unique idempotency key scoped to operation semantics.
4. Every entry is organization-scoped and account membership is proven server-side.
5. Available units equal posted credits minus posted debits minus active holds, subject to lot/expiry/stacking rules.
6. Reservation creation and availability validation occur atomically.
7. Redemption consumes only its active reservation and cannot exceed it.
8. Reservation release, expiry, redemption, and reversal are state transitions protected by version/precondition checks.
9. Negative available balances fail closed unless a separately approved account policy explicitly permits them.
10. Expired grants cannot be reserved; active reservations at expiry follow a versioned, disclosed rule.
11. Original entries are never edited or deleted; reversals cite the original entry.
12. Administrative adjustments require dedicated permission, reason, approval evidence, and audit event.
13. Partner charges require a valid service request, reservation/redemption linkage, and provider evidence.
14. Balance projections carry a ledger cursor/fingerprint and must reconcile to the immutable ledger.
15. Projection mismatch blocks financial-style claims and new redemption until resolved or safely isolated.
16. Credit lots retain source/funding/expiry attributes so consumption ordering is deterministic, such as earliest-expiring eligible lot first.
17. No operation crosses organization boundaries, even for parent/subsidiary structures; explicit governed transfers would require a future design.

## 8. Future API design

These are proposed contracts only. No route is approved.

### 8.1 Customer-safe reads

```text
GET /api/landlord/operational-credits/summary
GET /api/landlord/operational-credits/activity
GET /api/landlord/operational-credits/catalogue
GET /api/landlord/operational-credits/redemptions/:redemptionId/receipt
```

DTOs should expose display-safe service names, unit quantities, dates, status, expiry summaries, and safe reason labels. They must omit raw provider payloads, wholesale costs, internal IDs, idempotency keys, actor emails, storage paths, and policy internals.

### 8.2 Mutation protocol

```text
POST /api/landlord/operational-credits/reservations/preview
POST /api/landlord/operational-credits/reservations
POST /api/landlord/operational-credits/reservations/:id/cancel
POST /api/internal/operational-credits/redemptions/:id/complete
POST /api/internal/operational-credits/redemptions/:id/fail
```

All mutations require authenticated server-side scope, permission checks, an idempotency key, expected version/fingerprint, a valid service request, and safe retry semantics. Preview is non-authoritative; commit must revalidate within a transaction.

### 8.3 Protected administration

```text
POST /api/admin/operational-credits/grants/preview
POST /api/admin/operational-credits/grants
POST /api/admin/operational-credits/adjustments/preview
POST /api/admin/operational-credits/adjustments
POST /api/admin/operational-credits/redemptions/:id/reverse
GET  /api/admin/operational-credits/reconciliation
```

Admin routes require purpose-built permissions, separation of duties above configured thresholds, impersonation-write blocking, reason codes, and immutable audit evidence. General admin role alone should not imply mutation authority.

## 9. Provider abstraction and Certn integration plan

### 9.1 Provider-neutral contracts

```ts
interface OperationalServiceProviderAdapter {
  providerKey: string;
  supports(serviceKey: string, serviceVersion: string): boolean;
  quote(input: SafeServiceQuoteInput): Promise<ProviderQuoteEvidence>;
  submit(input: ReservedServiceRequest): Promise<PartnerTransactionEvidence>;
  getStatus(input: PartnerTransactionLookup): Promise<PartnerTransactionEvidence>;
  cancel?(input: PartnerTransactionLookup): Promise<PartnerTransactionEvidence>;
  normalizeWebhook(input: unknown): ProviderReconciliationEvent;
}
```

Core ledger code receives normalized evidence and never imports Certn-specific types. Provider adapters must not decide balances or mint credits.

### 9.2 Certn launch preparation

Before implementation:

- confirm products, wholesale prices, taxes, currency, volume tiers, refunds, cancellation, duplicate handling, outage terms, rate limits, data retention, reporting, and webhook guarantees;
- map each approved product to a versioned service catalogue item and configurable unit quantity;
- establish consent, permissible-purpose, privacy, report-access, and disclosure requirements;
- define partner transaction identifiers and idempotency behavior;
- create deterministic contract fixtures without live calls;
- define reconciliation between reservation/redemption, provider request, provider invoice/usage report, and customer-visible receipt;
- define outage behavior: preserve reservation for a bounded period, release it on terminal failure, and never double-submit on retry;
- define refund/reversal rules that preserve the original ledger and provider evidence.

Certn should be a preferred launch candidate only after commercial and technical approval. Current TransUnion/provider-neutral code should be audited for reusable patterns, not copied as proof of Certn readiness.

## 10. Subscription-entitlement and pricing model

Keep seven independent concepts:

1. platform subscription;
2. unit capacity;
3. staff seats and roles;
4. Operational Credit account and available units;
5. transaction-priced partner services;
6. implementation/onboarding fees;
7. enterprise support commitments.

Plan metadata may reference a versioned grant policy, never hardcoded quantities inside the ledger engine:

```ts
type OperationalCreditEntitlementRule = {
  ruleId: string;
  ruleVersion: string;
  planOrContractKey: string;
  billingInterval?: "annual" | "monthly" | null;
  grantUnits: number;
  creditType: "subscription_included" | "annual_renewal" | "enterprise_allocation";
  activationPolicyKey: string;
  expiryPolicyKey: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};
```

Working packaging direction, not approved pricing:

- Free/Starter: no recurring included allocation; approved services remain transaction-priced or use purchased credits only after legal/accounting approval.
- Landlord/Operator: annual incentive may reference an activation grant.
- Property Manager/Portfolio: organization pool, staff permissions, and usage controls.
- Institutional: contract-specific unit-based allocation and reporting.
- Enterprise: negotiated allocation, implementation, multi-organization governance, and support.

Financial-model inputs should include ARR, provider wholesale cost, displayed service value, expected redemption, expiry/breakage, refunds/reversals, gross margin, CAC, upgrade lift, renewal lift, screening volume, LTV, support cost, fraud loss, tax, and partner subsidy. The approximately `$30/unit/year` institutional benchmark remains a scenario, not approved public pricing.

## 11. Live-onboarding activation design

### 11.1 Records

An onboarding session should record organization, programme/policy versions, milestones, evidence references, reviewer state, and evaluation fingerprint. Milestones should be append-safe events with source and completion time.

### 11.2 Flow

```text
eligible subscription/contract event
  -> onboarding session opened
  -> milestone evidence appended
  -> eligibility preview generated
  -> manual approval or separately approved automated policy
  -> idempotent one-time grant
  -> activation notification from authoritative grant result
```

Controls:

- unique grant key for organization + entitlement event + campaign/policy version;
- no grant from client-reported milestones;
- cancellation/reversal through compensating ledger entries;
- expiry and disclosure version fixed at grant time;
- manual approval for early launch;
- automation remains separately gated and observable.

The phrase “Your RentChain Operational Credits are now active” must not appear until the grant is committed, the customer DTO is authoritative, and commercial/legal copy is approved.

## 12. Loyalty campaign model

Campaign configuration should include:

- campaign/version and lifecycle;
- eligible organization segments;
- qualifying evidence types;
- start/end and grant/expiry windows;
- maximum per organization, actor, source event, and campaign;
- once-only versus recurring cadence;
- stacking/exclusivity rules;
- funding source and funding cap;
- grant units and credit type;
- approval mode and reviewer threshold;
- disclosure/legal text version;
- abuse signals and manual-review triggers;
- reconciliation/reporting dimensions.

Possible sources include annual renewal, referral, portfolio expansion, onboarding completion, partner promotion, research participation, marketplace activity, seasonal campaigns, milestones, migration, and enterprise commitments. None is approved by inclusion here.

Anti-abuse controls should bind eligibility to verified organization identity and canonical qualifying evidence; detect shared identities, payment methods, domains, properties, referrals, and repeated cancellation/re-enrolment where lawful; apply velocity and cap rules; and route ambiguous cases to review without hidden denial or autonomous remediation.

## 13. Enterprise allocation model

Use an organization credit account as the economic pool and separate budget/allocation projections for control. An allocation must not duplicate credits.

Proposed hierarchy:

```text
contracting organization account
  -> legal-entity or subsidiary budget
  -> office/region/department budget
  -> cost centre
  -> optional user spending limit
```

Each budget has a period, catalogue restrictions, maximum units, reserved/redeemed totals, approvers, thresholds, and immutable allocation history. Parent access must be based on explicit organization relationships and permissions, not ID knowledge. Central pools, white-label programmes, government programmes, and API allocations require separate legal/security review.

## 14. Low-fidelity UX wireframes

All designs are future concepts and must remain hidden until supporting systems are approved.

### 14.1 Dashboard balance card

```text
+ Operational Credits ----------------------+
| Available                                  |
| 24 credits                                 |
| 4 reserved · 6 expire Sep 30               |
| [View activity] [Explore eligible services]|
+--------------------------------------------+
```

### 14.2 Activity history

```text
Operational Credit activity
[All] [Grants] [Reservations] [Used] [Reversed] [Expired]
Date       Description                 Change   Status
Aug 12     Annual plan allocation      +20      Available
Aug 18     Screening service             -3      Used
Aug 19     Screening request cancelled   +3      Reversed
```

### 14.3 Screening redemption confirmation

```text
Review service use
Service: Approved screening package
Required: 3 Operational Credits
Available after use: 21
Consent and application context: Complete
[Cancel] [Confirm and continue]
```

### 14.4 Insufficient-credit state

```text
More Operational Credits are required
Required: 3    Available: 1
No service has been ordered and no credits were used.
[Back to application] [Review available options]
```

### 14.5 Purchase-credit flow

Future only after legal/accounting/tax/refund approval. Show package terms, expiry/refund status, taxes, payer, and final amount before checkout. Never label it a cash balance or wallet.

### 14.6 Annual-plan incentive

```text
Annual plan benefit (subject to approved terms)
Includes an Operational Credit allocation after eligible onboarding.
[Review terms]
```

No quantity or value appears until approved configuration exists.

### 14.7 Live-onboarding activation

```text
Operational Credit activation
[x] Organization setup
[x] First property and unit
[ ] Eligible workflow milestone
Status: Not yet active
```

### 14.8 Admin adjustment workspace

```text
Adjustment preview
Organization: <display label>
Direction / units / reason / case reference
Before / after projection
Required approvals
[Cancel] [Submit for approval]
```

### 14.9 Enterprise allocation workspace

```text
Organization pool: 2,400 available
Department       Budget  Reserved  Used  Remaining
Leasing East       800       40     260       500
[Review allocations] [Export safe usage report]
```

### 14.10 Expiration, catalogue, receipt, and reversal

- Expiration notice: quantity, date, eligible services, and terms; no cash-value language.
- Catalogue: service label, required units, availability, provider-neutral description, and terms version.
- Receipt: service, units used, date, status, safe workflow label, and reversal linkage.
- Reversal: original service use, restored units, reason, date, and status; original row remains visible.

## 15. Security and abuse assessment

Primary threats and controls:

| Threat | Required control |
| --- | --- |
| Cross-organization access | Canonical server-side organization membership and exact account scope on every read/write |
| Double spend/race | Firestore transaction, active-reservation uniqueness, expected projection version, retry-safe idempotency |
| Duplicate grant/redemption | Semantic idempotency keys and unique source/workflow fingerprints |
| Unauthorized adjustment | Dedicated permission, approval threshold, reason, immutable audit, impersonation-write block |
| Expired-credit reuse | Lot-aware availability computed at transaction time |
| Invalid service request | Catalogue version, eligible workflow, consent/prerequisite, and provider readiness validation |
| Partner charge without evidence | Partner transaction must link to reservation, redemption, service request, and reconciliation evidence |
| Promotional account cycling | Verified organization/source evidence, campaign caps, velocity/risk review |
| Sensitive data exposure | Whitelist DTOs; exclude provider payloads, reports, credentials, paths, internal IDs, and wholesale pricing |
| Projection corruption | Cursor/fingerprint reconciliation; fail closed for new redemption on material mismatch |
| Insider misuse | Separation of duties, scoped admin roles, immutable audit, anomaly alerts, periodic review |

Privacy rules:

- credit records store the minimum workflow references needed for attribution;
- screening consent/report data remains in screening domains and is referenced, not copied;
- partner reporting uses purpose-limited safe projections;
- logs contain reason/status codes and correlation references, not raw reports, bank data, credentials, or tenant PII.

## 16. Legal and accounting questions

Required counsel/accounting review before implementation or public claims:

1. Do purchased credits create deferred revenue, contract liability, or another obligation?
2. When is revenue recognized: sale, reservation, fulfilment, expiry, or another event?
3. What tax applies to grants, purchases, bundled subscription allocations, and partner services?
4. What refund, reversal, cancellation, and expiry terms are enforceable and adequately disclosed?
5. Do gift-card, prepaid-purchase, consumer-protection, or unclaimed-property rules apply?
6. How should promotional versus purchased versus partner-funded units be accounted for and consumed?
7. May units expire, survive cancellation, transfer within an enterprise hierarchy, or be restored after refund?
8. Must cash conversion, peer transfer, external trading, and rent/deposit use be expressly prohibited in terms?
9. How are partner subsidies, wholesale costs, breakage, taxes, and refunds recorded?
10. What Certn contractual restrictions apply to bundling, resale, displayed value, reporting, refund, and product naming?
11. What privacy/consent limits apply to sharing usage or reconciliation data with partners?
12. What disclosures are required for annual-plan incentives, onboarding conditions, and promotional expiry?
13. Are credits available to consumers, businesses, or both, and do rules differ by province/customer type?
14. How should enterprise invoicing and contract-specific allocations be treated?

Initial restrictions should be no cash redemption, transfer, trading, blockchain representation, appreciation, ownership claim, bank withdrawal, rent payment, tenant deposit, stored-value representation, or use outside approved catalogue services.

## 17. Observability and reconciliation plan

### 17.1 Reconciliation layers

1. **Ledger-to-projection:** recompute credits, debits, holds, releases, expirations, and balances from entries.
2. **Reservation-to-redemption:** every consumed reservation has exactly one terminal redemption path; every active hold is within TTL.
3. **Redemption-to-service:** every redemption links to a valid service request and fulfilment result.
4. **Service-to-partner:** every external fulfilment links to normalized partner transaction evidence.
5. **Partner-to-commercial:** usage reports/invoices reconcile to partner transactions without exposing wholesale data to customers.
6. **Grant-to-entitlement/campaign:** every grant traces to approved policy/source evidence and respects caps.

### 17.2 Operational views and alerts

- projection mismatch and stale cursor;
- active reservation past expiry;
- duplicate idempotency/workflow fingerprint;
- partner submission without reservation;
- redemption without fulfilment;
- provider success without redemption;
- failed/retried provider transaction;
- manual grant/reversal/adjustment;
- expiring lots and unusual redemption velocity;
- organization/campaign/service usage;
- partner volume, provider cost, customer service consumption, and margin projections;
- credit liability/deferred-revenue reporting only after accounting policy approval.

Administrative actions require reason, actor, approval evidence, before/after projection, and immutable event. Operational logs remain non-financial and redacted unless a separately governed accounting projection is required.

## 18. Testing strategy

Use deterministic pure tests and Firestore emulator tests before any live provider test.

### 18.1 Domain tests

- promotional, purchased, subscription, renewal, referral, partner, enterprise, and administrative grants;
- reservation creation, partial eligibility, timeout, release, and terminal consumption;
- successful redemption, provider failure, cancellation, reversal, refund, and expiration;
- lot consumption order and stacking restrictions;
- duplicate request/idempotency collision;
- concurrent reservations and redemption race;
- insufficient and negative-balance rejection;
- projection rebuild and ledger equivalence;
- malformed, missing, stale, contradictory, and ambiguous evidence.

### 18.2 Integration and authorization tests

- organization isolation and canonical membership proof;
- staff limit, catalogue permission, approval threshold, and admin adjustment controls;
- subscription renewal/cancellation/upgrade/downgrade events without duplicate grants;
- onboarding milestone replay and one-time activation;
- campaign caps and abuse-review routing;
- partner outage, timeout, duplicate webhook, out-of-order webhook, retry, refund, and reconciliation;
- safe DTO redaction and absence of internal/provider identifiers;
- append-only reversal and audit history;
- export audience projection and institutional scope.

### 18.3 Required non-live fixtures

Provider contract tests must use recorded synthetic fixtures with no real reports, credentials, bank data, or tenant PII. Certn sandbox/live tests require separate credentials, legal/commercial approval, secrets handling, and a bounded validation plan.

## 19. Phased implementation roadmap

| Phase | Scope | Exit gate |
| --- | --- | --- |
| A | Approve terminology, legal/accounting posture, commercial assumptions, organization authority, and service-catalogue semantics | Signed decisions; no runtime work |
| B | Pure backend service-catalogue and ledger domain contracts/projections/tests, unmounted | Deterministic integrity and reconciliation tests |
| C | Firestore schema/query/index/rules/IAM design and emulator proof | Exact organization scope and transactional concurrency proof |
| D | Protected ledger persistence and projection rebuild tooling, feature-disabled | Reconciliation and audit evidence pass |
| E | Protected manual grant/reversal pilot with separation of duties | Bounded internal QA and incident/rollback runbook |
| F | Subscription/contract entitlement adapter, default-off | Idempotent renewal/cancellation/upgrade/downgrade proof |
| G | Reservation/redemption workflow against a synthetic internal service | Concurrency, timeout, reversal, and safe DTO proof |
| H | One approved Certn product adapter or another approved provider | Commercial, legal, privacy, sandbox, reconciliation, and outage gates |
| I | Guided onboarding activation, initially manually approved | Duplicate prevention and disclosure approval |
| J | Customer balance/history/redemption UI | Responsive/manual QA and claim review |
| K | Purchased credits | Legal, tax, accounting, refund, checkout, and revenue-recognition approval |
| L | Loyalty campaigns | Abuse, caps, funding, disclosure, and reporting approval |
| M | Enterprise budgets/allocations and institutional exports | Organization hierarchy, permissions, and export governance proof |
| N | Additional partner services | Per-provider/service approval and reconciliation |

Every phase should be a separate, reversible PR sequence with default-off exposure until its exit gate is met.

## 20. Recommended first production slice

The first implementation should be a **backend-only, pure, unmounted Operational Credits foundation**, not a production-visible feature:

```text
rentchain-api/src/lib/operationalCredits/
  catalogue contracts
  account and ledger entry types
  deterministic balance/availability projection
  reservation state machine
  idempotency/fingerprint helpers
  reversal and expiry validation
  safe non-financial validation envelopes
  focused tests
```

It should not import Firestore, Stripe, Certn, screening routes, environment variables, auth middleware, or UI code. It should not expose balances or create call sites. This slice proves domain vocabulary and integrity rules while commercial and legal decisions remain open.

Before that implementation PR is authorized, approve:

- organization authority model;
- unit semantics and integer limits;
- grant-lot/expiry policy shape;
- reservation and reversal state transitions;
- idempotency scope;
- accounting classification assumptions clearly marked preliminary;
- no-cash/no-transfer/no-rent boundary.

## 21. Explicit out of scope

- customer credit accounts or balances;
- mutable balance fields on user, landlord, or organization records;
- promotional grants, “free checks,” or annual-plan quantities;
- purchased credits, checkout, invoices, refunds, or tax behavior;
- credit reservation, redemption, reversal, expiration, or transfer in runtime;
- Certn API calls, credentials, webhooks, transactions, or production claims;
- changes to current TransUnion/provider screening behavior;
- changes to pricing, plan entitlements, subscription, billing, Stripe, or public marketing;
- live-onboarding grants or activation messages;
- loyalty/referral campaigns;
- enterprise allocation controls;
- customer/admin UI, routes, jobs, schedulers, notifications, exports, or Firestore schema/rules/indexes;
- payment collection, PAD, bank data, rent, tenant deposits, trust/custody, settlement, or money movement;
- cryptocurrency, blockchain, tokenization, transferability, cash conversion, or investment treatment;
- production/operational readiness claims;
- RC1 demo behavior changes.

## 22. Decision and next-step recommendation

Operational Credits are architecturally viable if RentChain treats them as a governed service-entitlement ledger rather than a promotion or money balance. The current platform provides useful patterns but not sufficient runtime authority for customer balances or redemptions.

Recommended next step after this plan is reviewed: a separately authorized docs-only decision record resolving organization authority, legal/accounting classification questions, initial service-catalogue scope, and commercial assumptions. Only after those decisions should a backend-only pure foundation PR be considered.

Do not launch “10 free credit checks,” publish a credit value, identify Certn as live, or add balance/redemption UI from this document.
