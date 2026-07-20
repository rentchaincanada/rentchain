# Certn Commercial and Allocation Strategy v1

## Status

Strategic negotiation preparation only. Certn is not represented here as integrated, contracted, commercially approved, or production-ready.

## Context

Draft PR #1431 identifies Certn as a preferred launch candidate while preserving a provider-neutral ledger and catalogue. Current code includes provider-neutral screening concepts and TransUnion-oriented paths; those do not establish Certn readiness. No confirmed Certn pricing, allocation, funding, API, webhook, support, geographic, consent, or marketing terms were found in the audited repository.

## Decision

Use a **staged pay-as-you-go wholesale relationship with pre-negotiated volume tiers and a capped co-funded onboarding pilot** as the preferred opening position.

Do not accept an exclusivity obligation, large annual minimum, customer-facing “free checks” promise, or hardcoded product economics before real demand, completion, failure, refund, and support data exist. After a bounded pilot, consider an annual commitment only if the discount exceeds the risk-adjusted unused commitment and preserves target margin.

Any Certn offering maps through the universal service catalogue and provider adapter. Certn product identifiers, prices, failures, and webhooks never become core ledger semantics.

## Commercial questions to resolve

- setup, certification, sandbox, or implementation fees;
- per-product wholesale prices, currency, tax, and price-change notice;
- minimum commitments, monthly minimums, tiers, overages, and included volume;
- promotional units, marketing-development funds, or co-funded onboarding;
- charges for failed, incomplete, duplicate, cancelled, retried, or expired checks;
- refund/credit-note rules and invoice dispute process;
- API, sandbox, webhook, idempotency, rate-limit, uptime, incident, and support terms;
- usage/invoice reports and reconciliation identifiers;
- data retention, deletion, residency, subprocessors, consent, and permissible purpose;
- branded/white-label reports, geographic/product availability, contract term, renewal, termination, exclusivity, and marketing permissions.

## Alternatives considered

The principal partnership structures are:

| Option | Advantage | Risk | Posture |
| --- | --- | --- | --- |
| RentChain-funded launch credits | Full control | Highest CAC and margin risk | Use only as capped experiment |
| Certn-funded promotion | Lowers CAC | Availability and messaging depend on contract | Seek as first preference |
| Shared-cost onboarding incentive | Aligns both parties | Requires exact attribution/reconciliation | Recommended bounded pilot |
| Volume-discount model | Improves margin with usage | Forecast risk | Negotiate tiers without premature commitment |
| Annual commitment with included volume | Best unit cost if volume is proven | Breakage/unused commitment | Defer until pilot data |
| Pay-as-you-go wholesale | Low commitment risk | Higher initial unit cost | Recommended launch base |
| Enterprise-specific bundles | Supports large contracts | Custom complexity and concentration | Offer only with signed enterprise demand |

## Rationale

The hybrid opening position increases Certn transaction opportunity while capping RentChain CAC and preserving optionality. It produces real redemption and support evidence before RentChain accepts fixed commitments or publishes an incentive.

## Consequences

- Pilot funding, maximum organization grants, eligible products, dates, and attribution must be explicit.
- Provider invoices and usage reports must reconcile to partner transactions and credit redemptions.
- Customer credit quantities remain configurable and need not equal reports or provider dollars.
- Volume-tier evaluation uses completed/chargeable outcomes under the contract, not raw requests.
- A provider outage or failed check must follow agreed reservation release/reversal rules.

## Risks

- Wholesale price or product changes could create negative-margin redemptions.
- Minimums or exclusivity could reduce provider portability.
- Co-marketing language could overstate integration or “free” value.
- Failed-check charging and incomplete webhooks could create unreconciled cost.
- Provider reporting may expose sensitive applicant information if not purpose-limited.

## Open questions

- Which product and jurisdictions are suitable for a bounded launch?
- Who pays for incomplete, cancelled, duplicate, retried, or provider-failed requests?
- What margin floor and CAC cap must every incentive preserve?
- What pilot size provides useful evidence without material liability?
- Can partner funding be credited directly on invoices rather than represented as customer cash value?
- What termination/export/deletion support exists if RentChain changes providers?

## Dependencies

- approved classification, organization authority, and catalogue decisions;
- legal/privacy/security provider diligence;
- confirmed screening consent and permissible-purpose workflow;
- reservation/redemption and partner reconciliation design;
- financial model and target margin;
- signed commercial terms and approved marketing language.

## Legal or accounting review requirements

Review resale/referral rights, promotional funding, taxes, refunds, data processing, consumer disclosures, liability, service failures, record retention, revenue/cost recognition, and contract termination.

## Security implications

Require secrets management, signed webhook verification, idempotency, least-privilege API access, audit-safe logging, incident contacts, rate-limit/outage behavior, and no raw reports in credit records.

## Privacy implications

Define controller/processor roles, consent, permissible purpose, minimization, retention/deletion, residency, subprocessors, report access, data-subject handling, and safe usage reporting before exchanging production data.

## Enterprise implications

Enterprise bundles require contract-specific catalogue policies, jurisdictions, volume bands, reporting, support, and governance. They must not force a global provider choice or cross-organization data sharing.

## Implementation constraints

- No Certn types in the ledger core.
- No provider call before valid consent, service request, eligibility, and reservation.
- Provider idempotency and reconciliation identifiers required.
- No negotiated number hardcoded in code or public copy.
- Provider replacement and suspension remain possible.

## Explicit out of scope

Certn outreach or contracting, API credentials, sandbox/live calls, webhook code, reports, customer grants, screening execution changes, public announcements, pricing changes, and production incentives.

## Conditions required before implementation

1. Signed commercial and data-processing terms resolve the listed questions.
2. One product/jurisdiction is approved for a bounded pilot.
3. Margin, CAC, funding cap, refund, and failed-check models pass review.
4. Security/privacy, consent, sandbox, webhook, outage, and reconciliation tests pass.
5. Customer claims and disclosures receive legal/commercial approval.
