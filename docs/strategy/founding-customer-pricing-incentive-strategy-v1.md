# Founding Customer Pricing and Annual Incentive Strategy v1

## Status

Scenario analysis and decision framework only. No price, plan name, unit cap, allocation, “free check,” entitlement, or public claim is approved.

## Context

Current public plan code presents Free, Starter at `$29/month`, Pro at `$49/month`, and Elite at `$79/month`, with yearly prices and pay-per-use screening. Existing enterprise strategy treats approximately `$30/unit/year` and enterprise minimums as planning references, not public commitments.

This mission asks to evaluate working targets of approximately `$39/month` for Landlord/Operator, `$89/month` for Property Manager/Portfolio, approximately `$30/unit/year` for Institutional, a working `$249/month` institutional floor, and custom Enterprise contracts. These labels and numbers conflict with current public naming/pricing and therefore remain scenarios requiring a separate packaging/pricing decision. They must not be encoded or published from this record.

## Decision

The recommended founding incentive is a **small, capped annual-plan Operational Credit allocation activated after verified onboarding milestones**, not “10 free credit checks.”

Use Operational Credit units rather than report counts, set an expiry window with approved disclosure, release the allocation once per organization/eligible annual subscription, and preserve pay-as-you-go screening outside the allocation. Consider a smaller staged release if fraud, breakage, or onboarding quality is uncertain.

Final quantity must be solved from confirmed provider cost, expected redemption, support/refund cost, partner subsidy, plan gross-margin floor, and measured conversion lift. No quantity is recommended in this record.

## Working packaging scenarios

| Segment | Working scenario | Credit posture |
| --- | --- | --- |
| Free / Starter | `$0`, limited basic workflows | No recurring included allocation; eligible services transaction-priced subject to approval |
| Landlord / Operator | Approximately `$39/month`; `$29/month` may remain founding price | Annual-only, milestone-activated capped allocation |
| Property Manager / Portfolio | Approximately `$89/month`; current `$49/month` is a separate existing tier reference | Larger organization allocation only if unit cap, staff value, and margin support it |
| Institutional | Approximately `$30/unit/year`, minimum ACV, working `$249/month` floor | Contract allocation with governance/reporting; validate floor against support cost |
| Enterprise | Custom annual contract, possible implementation fee and minimum ACV | Negotiated allocation, catalogue, security, integration, and support terms |

These are not a recommendation to rename current plans or change prices.

## Sustainability model

Define:

```text
expected incentive cost
  = granted units
  x expected redemption rate
  x blended fulfilled-service cost per unit
  + expected failed/refunded service cost
  + incremental support and fraud cost
  - confirmed partner subsidy

incremental annual contribution
  = annual plan revenue
  - subscription delivery cost
  - expected incentive cost
  - payment/refund cost
  - incremental support cost

required conversion lift
  = expected incentive cost / contribution margin per incremental annual customer
```

Model ARR, gross margin, Certn/other provider cost, redemption, expiry/breakage, annual conversion, renewal, churn, LTV, CAC, subsidy, support, tax, refund, and included-versus-purchased economics by cohort.

### “10 free credit checks” test

Ten checks are sustainable only if:

```text
10 x expected chargeable completion rate x all-in provider cost
+ failures/refunds/support/fraud
- contractual partner subsidy
<= approved incentive budget per converted annual customer
```

It must also preserve the plan’s gross-margin floor under high redemption and renewal scenarios. Without confirmed wholesale cost, subsidy, conversion lift, and unit economics, sustainability is unproven. The phrase hardcodes one service and overstates value; reject it as the initial architecture and marketing construct.

## Alternatives considered

| Alternative | Assessment |
| --- | --- |
| Ten free checks at signup | Highest activation simplicity but greatest fraud, margin, coupling, and claim risk; reject |
| Ten Operational Credits | Provider-neutral but quantity still unsupported; retain only as a model scenario |
| Partial screening discount | Limits cost but complicates price/credit interaction and disclosures |
| Credits after onboarding | Best alignment with activation and abuse prevention; recommended |
| Credits released over time | Reduces cost spike but adds lifecycle complexity; consider after launch evidence |
| Applicant-paid screening | Protects landlord plan margin but requires legal/customer-experience review |
| Certn-funded promotion | Best CAC economics if contractually confirmed; pursue in negotiation |
| Annual-plan-only eligibility | Aligns incentive with conversion and cash commitment; recommended |
| Expiring launch credits | Limits liability but requires lawful terms and clear notice; conditionally recommended |

## Rationale

A milestone-activated annual allocation rewards meaningful onboarding, ties cost to a higher-value commitment, reduces repeated-account abuse, remains provider-neutral, and allows a partner subsidy without promising a fixed number of reports.

## Consequences

- Monthly and free plans remain transaction-priced unless separately approved.
- The entitlement event, milestone evidence, grant, expiry, and cancellation behavior need versioned rules.
- Founding pricing and target pricing need cohort identifiers and cannot silently change existing customers.
- Customer acquisition and redemption cohorts must be measured before increasing allocations.
- Purchased credits remain deferred.

## Risks

- A generous allocation can create negative-margin annual plans.
- A small or highly conditional incentive may not improve conversion.
- Expiry or staged release may confuse customers or trigger legal disclosure requirements.
- Founding-price grandfathering can create long-term packaging complexity.
- Applicant-paid models may create jurisdictional or fairness concerns.

## Open questions

- What are confirmed provider costs by product, failure, refund, and jurisdiction?
- What annual conversion lift and retention effect are realistically attributable to the incentive?
- What gross-margin floor and maximum incentive CAC are approved by segment?
- What unit caps, staff seats, support, and catalogue services define each proposed tier?
- Are `$39`, `$89`, `$249`, and `$30/unit/year` compatible with current plan migration and customer expectations?
- What expiry, cancellation, grandfathering, tax, and disclosure rules apply?

## Dependencies

- approved classification, organization authority, catalogue, and Certn strategy;
- canonical subscription ownership and annual entitlement event;
- cohort pricing/plan migration strategy;
- legal/accounting review and customer terms;
- confirmed provider economics and partner subsidy;
- analytics definitions and experiment governance.

## Legal or accounting review requirements

Review price/discount disclosures, subscription bundling, expiry, cancellation, refunds, taxes, promotional terms, applicant-paid screening, revenue recognition, deferred revenue, grandfathering, and partner subsidy treatment.

## Security implications

Eligibility and milestones require authoritative server evidence, one-time semantic idempotency, organization isolation, campaign caps, abuse review, and no client-triggered grants.

## Privacy implications

Conversion and redemption analytics should use minimized cohort data. Do not use screening results or sensitive applicant attributes for marketing eligibility. Partner subsidy reporting must be purpose-limited.

## Enterprise implications

Institutional and enterprise allocations belong in contracts with unit definitions, true-up, service limits, reporting, support, security, and expiry terms. The `$249/month` floor may be too low for implementation or governance cost and needs cost-to-serve validation.

## Implementation constraints

- No hardcoded prices, quantities, plan mappings, or provider costs.
- No grant before canonical annual entitlement and onboarding evidence.
- No balance/UI claim before ledger and projection authority.
- Experiment variants and cohorts must be versioned and reviewable.
- High-redemption and no-subsidy scenarios must pass margin gates.

## Explicit out of scope

Pricing changes, plan renaming, public copy, entitlements, checkout, billing, grants, onboarding automation, analytics implementation, Certn integration, purchased credits, UI, Firestore, or RC1 behavior.

## Conditions required before implementation

1. Finance approves segment contribution-margin floors and maximum incentive CAC.
2. Provider costs/subsidies and chargeable outcomes are contractually confirmed.
3. Legal/accounting approve promotion, expiry, cancellation, tax, and disclosure treatment.
4. Product approves plan naming, unit caps, annual entitlement, milestones, and experiment design.
5. A bounded pilot has explicit stop-loss, cohort, review, and rollback criteria.
