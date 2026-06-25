# Next Quarter Mission Queue v1

Branch: `docs/strategic-execution-plan-enterprise-readiness-v1`
Scope: mission queue only; no implementation authorization.

## Queue Rule

This queue prioritizes stabilization, enterprise readiness audits, revenue features, lease-up pipeline, and enterprise layer work.

It does not authorize implementation. Each item still requires its own mission brief or operator-approved mission prompt.

## Phase 0: Stabilization And Polish

### `feat/property-manager-company-email-notifications-v1`

Issue: #1232

Scope:

- notify PM company when landlord creates pending relationship
- notify landlord when PM company accepts
- notify landlord when assignment is created/removed
- notify PM company when relationship is suspended/terminated
- failed email dispatch must not block lifecycle state changes

### `fix/lease-signed-document-retrieval-and-cancelled-state-v1`

Issue: #1233

Scope:

- harden signed/cancelled document state
- avoid broken generic fallback
- show clear unavailable/cancelled/admin-review state
- preserve provider/storage safety

### `feat/delegated-access-mobile-information-architecture`

Issue: #1221

Scope:

- make delegated access history and summary surfaces easier to scan on mobile
- preserve history and audit visibility

### `feat/property-manager-company-assignment-grouping-v1`

Scope:

- group assignments by relationship/company/staff where helpful
- preserve safe labels
- avoid raw IDs as user-facing labels

### `feat/property-manager-company-timeline-history-v1`

Scope:

- relationship and assignment timeline history
- status transitions
- metadata-only audit references

## Phase 1: Enterprise Readiness

### `docs/enterprise-readiness-scorecard-v1`

Scope:

- convert readiness audit into scorecard
- assign owners, risk, and prerequisites

### `audit/lease-renewal-route-visibility-v1`

Scope:

- confirm renewal route/navigation visibility
- decide whether `/lease-renewal` should exist or redirect
- preserve renewal source of truth

### `audit/payments-pad-readiness-v1`

Scope:

- audit payment architecture for PAD readiness
- identify mandate, consent, return, cancellation, reconciliation, and support gaps

### `audit/screening-certn-readiness-v1`

Scope:

- audit screening/provider readiness
- separate manual workflow from automated dispatch
- define consent, callback, result, and review boundaries

### `audit/vacancy-publishing-source-of-truth-v1`

Scope:

- define vacancy/pending-vacancy source of truth
- identify public-safe listing projection
- define publish approval rules

## Phase 2: Revenue Features

### `research/pad-payments-canada-provider-options-v1`

Issue: #1235

Scope:

- provider options
- mandate requirements
- reconciliation and returns
- recommendation before implementation

### `feat/pad-authorization-foundations-v1`

Scope:

- tenant PAD authorization record
- payment schedule intent
- cancellation/amendment lifecycle
- audit and consent foundations

### `feat/manual-screening-workflow-v1`

Scope:

- application-linked manual screening
- consent/status workflow
- landlord/admin review
- audit trail

### `feat/certn-application-screening-dispatch-v1`

Scope:

- application screening dispatch through approved provider path
- consent and disclosure
- callback/status normalization
- manual review fallback

### `feat/vacancy-publishing-feed-api-v1`

Issue: #1236

Scope:

- landlord-approved public-safe vacancy feed/API
- no tenant PII
- no raw internal IDs as labels

### `feat/public-vacancy-listing-page-v1`

Scope:

- public listing page backed by approved vacancy projection
- inquiry/viewing call-to-action
- no private landlord or tenant metadata

## Phase 3: Lease-Up Pipeline

### `feat/renewal-decision-to-vacancy-pipeline-v1`

Scope:

- renewal decision outcome
- pending vacancy creation
- availability date
- publish eligibility

### `feat/viewing-request-intake-v1`

Scope:

- inquiry/viewing intake from public listing
- landlord review and scheduling state
- tenant/applicant-safe communication

### `feat/application-to-screening-to-lease-workflow-v1`

Scope:

- application progression
- screening status
- approval
- lease draft and execution handoff

## Phase 4: Enterprise Layer

### `docs/enterprise-pricing-packaging-v1`

Scope:

- preserve Free, Starter, Pro, Elite as current tiers
- define Enterprise as future operational layer
- avoid billing implementation

### `feat/enterprise-api-key-management-v1`

Scope:

- API keys
- scoped access
- rate limits
- audit events
- read-only first API surfaces

### `feat/portfolio-reporting-v1`

Scope:

- portfolio KPIs
- vacancy/occupancy
- lease-up
- payments
- screening
- PM company summaries

### `feat/accounting-export-framework-v1`

Issue: #1240

Scope:

- accounting export contract
- rent ledger and payment mapping
- CSV-first export
- no live write integration

### `docs/development-to-lease-up-enterprise-module-v1`

Scope:

- development readiness to operations handoff
- not construction management replacement
- module boundaries and audit requirements

## Immediate Recommendation

Recommended first next mission:

```text
feat/property-manager-company-email-notifications-v1
```

Reason:

PM Company workflows are already validated and should be polished before adding broader enterprise revenue features.

Recommended parallel planning/audit track:

```text
audit/lease-renewal-route-visibility-v1
```

Reason:

Lease renewal visibility is a revenue lifecycle risk and should be clarified before vacancy publishing work begins.
