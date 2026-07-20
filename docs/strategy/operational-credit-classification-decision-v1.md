# Operational Credit Classification Decision v1

## Status

Proposed for review. Not legally approved, accounting-approved, commercially agreed, or authorized for implementation.

## Context

The governing architecture in draft PR #1431 defines RentChain Operational Credits as a non-cash, organization-scoped right to consume approved services through an immutable ledger. RentChain has no production Operational Credit account, balance, grant, purchase, reservation, or redemption system today.

Classification must prevent promotional language from creating an unintended cash, deposit, stored-value, gift-card, or transferable-property promise. It must also keep Operational Credits separate from rent, security deposits, PAD, landlord receivables, payment processing, and the existing lease credit-allocation workflow.

## Decision

The proposed initial release classification is **promotional or subscription-included service credits owned by a RentChain customer organization**.

For the initial release, Operational Credits would:

- be redeemable only for versioned, approved RentChain operational services;
- remain non-transferable between organizations and not become personal property of users;
- have no cash redemption, withdrawal, external exchange, peer transfer, or bank payout;
- be unusable for rent, security deposits, tenant payments, or other money movement;
- have no blockchain representation and no cryptocurrency, investment, appreciation, or ownership language;
- not be purchasable until separate legal, accounting, tax, refund, and consumer-protection approval exists.

This is an architectural recommendation, not a legal conclusion.

### Classification by source

| Source | Proposed treatment | Initial-release posture |
| --- | --- | --- |
| Promotional credits | Conditional service rights granted without separate purchase, subject to disclosed eligibility and expiry | Candidate after legal/commercial approval |
| Subscription-included credits | Service rights arising from a versioned annual plan or contract entitlement; subscription access remains separate | Preferred initial grant source |
| Partner-funded credits | Promotional/service rights with attributable partner funding and contract-specific restrictions | Deferred until partner agreement and accounting treatment |
| Purchased credits | Prepaid service rights acquired for consideration | Deferred; not in initial release |
| Administrative adjustments | Governed corrections or exceptional grants/debits; not a customer product category | Protected operational tool only after controls exist |

## Alternatives considered

1. **Cash-equivalent wallet:** rejected because it increases payments, custody, consumer-protection, and accounting risk.
2. **One credit equals one screening report:** rejected because it couples the platform to one product/provider.
3. **User-owned balances:** rejected because subscription, commercial liability, and enterprise authority belong at organization scope.
4. **Discount coupons only:** rejected because coupons cannot support reservations, multiple services, reversals, or enterprise allocation cleanly.
5. **Purchased credits at launch:** deferred because refund, tax, expiry, revenue-recognition, and prepaid-service treatment are unresolved.

## Rationale

The service-credit classification supports annual subscription incentives and provider-funded campaigns without representing customer deposits or money held by RentChain. It preserves a reusable catalogue while keeping legal and accounting questions visible rather than embedding assumptions in code or marketing.

## Consequences

- Each grant lot needs its source, policy version, disclosure version, funding source, eligibility, and expiry terms.
- Customer language must describe eligible services and units, not cash value.
- Subscription cancellation, service failure, expiry, and reversal need explicit terms.
- Purchased credits require a separate decision and cannot be activated by configuration alone.
- Accounting projections may need to distinguish promotional, subscription-included, partner-funded, and purchased lots.

## Risks

- A regulator, court, auditor, tax authority, or customer contract may classify some credits differently.
- Displaying monetary value or broad redemption promises could undermine the intended classification.
- Expiration, breakage, partner funding, or subscription bundling may create liabilities or disclosure duties.
- Inconsistent marketing could imply property ownership or guaranteed value.

## Open questions

- When, if ever, does a grant create deferred revenue or a contract liability?
- When is revenue recognized for subscription-included, partner-funded, or purchased credits?
- Which sales taxes apply to grants, purchases, redemptions, and bundled services?
- What expiry periods and notices are lawful and commercially acceptable?
- What refund or restoration is required after service failure or cancellation?
- Do gift-card, prepaid-service, consumer-protection, or unclaimed-property rules apply?
- What happens to unused credits on subscription termination or organization closure?
- Can enterprise contracts override default expiry or allocation terms?

## Dependencies

- approved organization authority model;
- versioned universal service catalogue;
- legal/accounting/tax memorandum by customer type and jurisdiction;
- subscription-entitlement ownership and lifecycle design;
- immutable ledger, lot, expiry, reversal, and reconciliation design;
- approved customer terms and disclosure language.

## Legal or accounting review requirements

Counsel and accounting reviewers must address deferred revenue, revenue recognition, sales tax, expiry, refund, cancellation, disclosures, prepaid-service/gift-card treatment, unclaimed property, partner-funded credits, subscription termination, enterprise contracts, and record retention before implementation.

## Security implications

Classification does not reduce the need for transactional double-spend prevention, immutable audit evidence, protected adjustments, exact organization scope, and fail-closed reconciliation.

## Privacy implications

Credit records should reference only the minimum organization, service, workflow, actor, and partner evidence required. Screening reports, consent payloads, provider payloads, bank data, and unrelated tenant PII must remain outside the credit ledger.

## Enterprise implications

Enterprise contracts may define allocation, expiry, funding, and catalogue terms, but must not convert credits into transferable employee property or cross-organization cash value. Contract exceptions require versioned policy and audit evidence.

## Implementation constraints

- Integer operational units only; no floating monetary representation.
- Source-specific lots and deterministic consumption ordering.
- No mutable balance as sole truth.
- No purchase, checkout, transfer, or cash-value API in the initial implementation.
- No customer claim before legal/commercial copy approval.

## Explicit out of scope

Runtime accounts, grants, balances, purchasing, checkout, refunds, redemption, Certn transactions, pricing changes, billing changes, Firestore changes, UI, marketing claims, PAD, rent, deposits, and money movement.

## Conditions required before implementation

1. Legal and accounting reviewers document the accepted initial classification and jurisdiction scope.
2. Product and commercial owners approve source types, expiry/refund posture, and disclosures.
3. Purchased credits remain explicitly disabled.
4. Organization authority and catalogue decisions are approved.
5. Security and reconciliation designs pass separate review.
