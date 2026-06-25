# Enterprise Landlord Feedback Brief v1

Branch: `docs/enterprise-layer-roadmap-v1`
Scope: strategic documentation only; no product implementation, pricing change, payment integration, screening integration, or API exposure.

## Source Context

RentChain received enterprise-scale feedback from a real landlord operating a portfolio of 3,000+ units. The operating environment includes:

- a large landlord ownership group
- a separate property management company
- a development and architecture firm context
- current comparison against Yardi Voyager
- live testing of RentChain's free-tier experience

This brief treats the feedback as strategic input. It does not imply that RentChain currently supports all enterprise workflows described here.

## Portfolio Profile

The feedback came from a 3,000+ unit portfolio, which changes the product requirements materially.

Large portfolios need:

- multi-entity and multi-property governance
- reliable account, role, and staff management
- high-volume lease, tenant, and unit operations
- payment automation and reconciliation
- vacancy publishing at portfolio scale
- auditability across internal and external operators
- accounting and export discipline
- support and onboarding paths that can handle operational complexity

Free-tier workflows can demonstrate product direction, but they are not sufficient for an enterprise landlord operating thousands of units.

## Current Platform Reference

The current comparison platform is Yardi Voyager.

Yardi Voyager should be treated as mature enterprise property management and accounting infrastructure. RentChain should not claim to replace Yardi today.

The relevant benchmark is not only feature count. Yardi-like enterprise expectations include:

- accounting workflows
- leasing workflows
- bulk portfolio operations
- organization and staff governance
- reporting
- integrations
- support processes
- mature operational controls

RentChain's strategic opportunity is to compete through focused wedge features first, not by presenting an immediate full-suite replacement.

## Pricing Benchmark

The enterprise benchmark surfaced in the feedback is approximately `$30/unit/year`.

For a 3,000+ unit portfolio, this implies a reference annual spend near:

```text
3,000 units x $30/unit/year = $90,000/year
```

This is a directional market reference, not an approved RentChain pricing model.

The current codebase has multiple pricing references and compatibility mappings. Any enterprise packaging mission should first audit canonical backend pricing, frontend pricing copy, entitlements, plan mapping, billing contracts, and legacy compatibility behavior.

## Feature Asks

### Enterprise Layer

The landlord feedback indicates RentChain needs an enterprise layer for large portfolios.

This means more than a higher price point. It requires governance, scale, support, reporting, permission, and integration foundations.

### Automatic Pre-Authorized Debit

Automatic pre-authorized debit, or PAD, is considered necessary for landlord adoption.

RentChain currently has payment architecture and Stripe-oriented rent payment surfaces, but PAD requires a separate Canadian payment-rail feasibility review, mandate/authorization flow, compliance review, reconciliation model, failed-payment handling, and tenant consent UX.

### Vacancy And Pending-Vacancy Publishing

Large landlords need vacancy and pending-vacancy data surfaced on their own websites.

The safest first step is likely a landlord-scoped vacancy feed or API with:

- public-safe listing fields
- explicit publish controls
- no tenant PII
- no internal unit IDs as user-facing labels
- rate limiting and API-key governance
- pending-vacancy lifecycle semantics

### Screening

Screening is required.

Minimum viable enterprise fit:

- manual screening workflow from applications
- status tracking
- consent preservation
- review notes
- audit trail

Paid add-on:

- automated screening from applications
- provider integration
- consent and disclosure flow
- callback/webhook normalization
- manual review fallback

### Enterprise Comparison To Yardi

The comparison against Yardi Voyager sets expectations around complex accounting, leasing, and operational workflows.

RentChain should treat that as a roadmap pressure, not a claim target for current readiness.

## Strategic Implications

RentChain's current direction is strongest where it can be:

- workflow-governed
- tenant-facing
- evidence-aware
- audit-safe
- API-friendly
- faster to adopt than legacy enterprise platforms

The enterprise layer should be built as a governed extension of existing product foundations rather than a separate product silo.

Immediate strategic priorities:

1. Clarify packaging and commercial tiers.
2. Add enterprise-readiness foundations before sales commitments.
3. Prioritize revenue-critical wedge features: PAD, vacancy feed/API, screening workflow.
4. Preserve governance-first architecture during scale features.
5. Avoid promising full Yardi replacement until accounting and operational breadth are proven.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Overclaiming enterprise readiness | Sales and trust risk | Keep current-vs-future language explicit. |
| Underestimating accounting complexity | Product scope blow-up | Start with exports and reconciliation boundaries before full accounting. |
| PAD compliance complexity | Payment and legal risk | Run provider and compliance research before implementation. |
| Screening automation risk | Privacy and compliance risk | Start with manual workflow and consent-preserving provider boundaries. |
| Vacancy publishing leakage | Tenant/privacy risk | Publish only public-safe listing data. |
| Enterprise role sprawl | Authorization risk | Build role templates and org hierarchy through fail-closed server-side evaluation. |
| Competing directly with Yardi too early | Strategic distraction | Use wedge features and integration-friendly posture first. |

## Opportunity Assessment

The opportunity is meaningful because a 3,000+ unit operator is exposing needs that map directly to enterprise revenue potential.

High-opportunity areas:

- PAD rent payment automation
- vacancy feed/API for landlord websites
- application screening workflow
- property manager company operations
- portfolio reporting
- accounting exports
- audit/evidence packages

The right sequence is not to build everything at once. RentChain should first prove a small set of high-value enterprise workflows that large landlords cannot ignore and that do not require replacing all accounting and property management infrastructure on day one.
