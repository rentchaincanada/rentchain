# Q3 Product Priorities v1

Branch: `docs/strategic-execution-plan-enterprise-readiness-v1`
Scope: strategic product prioritization only; no implementation.

## Priority 1: Polish And Stabilize PM Company Platform

### Why It Matters

PM Company support is now one of RentChain's strongest enterprise differentiators. It reflects how real large landlords operate with external or separate property management companies.

### Business Value

- supports professional property management operations
- reduces shared-login pressure
- preserves staff attribution
- supports multi-landlord PM companies
- creates a path to enterprise governance and onboarding

### Customer Validation

Recent enterprise feedback involved a landlord, property management company, and development/architecture context. The PM Company model aligns directly with that operating reality.

### Required Missions

- `feat/property-manager-company-email-notifications-v1`
- `feat/property-manager-company-assignment-grouping-v1`
- `feat/property-manager-company-timeline-history-v1`
- `feat/property-manager-company-mobile-polish-v1`

### Non-Goals

- no contractor organization work
- no billing delegation
- no custom permission builder

## Priority 2: PAD Payments

### Why It Matters

Automatic pre-authorized debit is a core enterprise buying requirement for rent collection.

### Business Value

- directly supports recurring rent collection
- increases revenue relevance for larger landlords
- creates a premium/enterprise differentiator
- supports payment operations and reconciliation workflows

### Customer Validation

The 3,000+ unit feedback identified PAD as necessary.

### Required Missions

- `audit/payments-pad-readiness-v1`
- `research/pad-payments-canada-provider-options-v1`
- `feat/pad-authorization-foundations-v1`

### Non-Goals

- no production PAD provider integration before research
- no billing changes in the audit/research phase
- no tenant mandate UX without legal/compliance review

## Priority 3: Manual To Automated Screening

### Why It Matters

Screening is required for enterprise adoption. Manual screening is the minimum credible workflow; automated screening from applications should become a paid add-on only after manual foundations are safe.

### Business Value

- supports application conversion
- creates add-on revenue potential
- improves landlord review workflows
- strengthens evidence and consent posture

### Customer Validation

Enterprise feedback identified screening as required.

### Required Missions

- `audit/screening-certn-readiness-v1`
- `feat/manual-screening-workflow-v1`
- `feat/certn-application-screening-dispatch-v1`

### Non-Goals

- no autonomous screening decisioning
- no raw provider payload exposure
- no automation claim until dispatch, consent, callback, and review states are implemented

## Priority 4: Lease-Up And Vacancy Publishing Pipeline

### Why It Matters

Vacancy and pending-vacancy publishing connects RentChain to landlord revenue. Renewal decisions should feed vacancy scheduling, public availability, applications, screening, leases, occupancy, payments, and operations.

### Business Value

- supports lease-up
- supports landlord-owned website listings
- connects existing workflow surfaces into a revenue lifecycle
- creates API and integration opportunities

### Customer Validation

The customer asked for vacancy or pending-vacancy API or embeddable listing access.

### Required Missions

- `audit/lease-renewal-route-visibility-v1`
- `audit/vacancy-publishing-source-of-truth-v1`
- `feat/renewal-decision-to-vacancy-pipeline-v1`
- `feat/vacancy-publishing-feed-api-v1`
- `feat/public-vacancy-listing-page-v1`

### Non-Goals

- no public listing without landlord publish approval
- no tenant PII in vacancy feeds
- no raw internal IDs as public labels

## Priority 5: Enterprise Planning And Integrations

### Why It Matters

Enterprise needs careful packaging, API scope, accounting/export strategy, onboarding, and support before large customer commitments.

### Business Value

- supports credible enterprise conversations
- reduces overcommitment risk
- defines implementation support boundaries
- creates integration roadmap for larger portfolios

### Customer Validation

Enterprise feedback confirmed need for workflows beyond current Free, Starter, Pro, and Elite tiers.

### Required Missions

- `docs/enterprise-pricing-packaging-v1`
- `feat/enterprise-api-key-management-v1`
- `feat/portfolio-reporting-v1`
- `feat/accounting-export-framework-v1`
- `docs/development-to-lease-up-enterprise-module-v1`

### Non-Goals

- no incumbent replacement claim
- no live accounting write integration
- no public enterprise API without scoped key management

## Q3 Execution Rule

Stabilization and revenue workflows come before institutional differentiation.

Institutional reporting, board/tribunal packages, policy orchestration, and broad enterprise audit consoles should remain later-phase work until PAD, screening, vacancy publishing, PM Company polish, and renewal continuity are stable.
