# Enterprise Implementation Plan v1

Branch: `docs/enterprise-layer-roadmap-v1`
Scope: strategic implementation preparation only; no product implementation.

## Implementation Principles

Enterprise work should follow RentChain's governance-first pattern:

- backend authority before UI
- fail-closed authorization
- projection-safe reads
- append-safe audit history
- metadata-first integrations
- no public claims beyond implemented behavior
- no broad enterprise replacement claims

Enterprise delivery should be phased. The goal is not a single giant enterprise launch. The goal is a sequence of reviewable missions that address adoption blockers.

## Phase 1: Enterprise Readiness Foundations

Purpose: define the commercial, authority, scale, and integration boundaries before building revenue-critical features.

### Mission: Enterprise Pricing And Packaging

Branch: `docs/enterprise-pricing-and-packaging-v1`

Scope:

- audit canonical pricing and entitlement files
- reconcile current tier docs and code references
- propose Free, Professional, and Enterprise packaging
- document `$30/unit/year` benchmark as market input, not approved pricing
- define enterprise add-ons without changing billing

### Mission: Enterprise Account Model Audit

Branch: `docs/enterprise-account-model-audit-v1`

Scope:

- audit landlord owner, PM company, delegate, tenant, contractor, and support roles
- define enterprise ownership hierarchy requirements
- identify account/profile/session gaps
- recommend server-side role resolution missions

### Mission: Portfolio Scale Constraints Audit

Branch: `docs/enterprise-portfolio-scale-constraints-v1`

Scope:

- audit frontend and backend assumptions around property/unit counts
- identify query, pagination, indexing, and rendering risks
- define scale thresholds for 3,000+ units
- recommend data access and UX hardening missions

### Mission: API And Security Scope Audit

Branch: `docs/enterprise-api-security-scope-v1`

Scope:

- define API-key requirements
- define scope model
- define rate limiting and audit requirements
- classify public-safe and private-safe projections
- recommend first API surface

### Mission: Billing/PAD Feasibility Audit

Branch: `research/pad-payments-canada-provider-options-v1`

Scope:

- research Canadian PAD providers and rails
- define tenant authorization requirements
- define reconciliation, returns, cancellation, and amendment needs
- compare provider options
- recommend implementation path

## Phase 2: Revenue-Critical Features

Purpose: build the features most likely to unblock enterprise adoption and revenue conversations.

### Mission: PAD Payments

Branch: `feat/pad-payment-authorizations-v1`

Scope:

- tenant PAD authorization model
- landlord payment schedule model
- provider-neutral mandate references
- audit and consent records
- no provider launch until research approves one

### Mission: Manual Application Screening Workflow

Branch: `feat/applications-manual-screening-workflow-v1`

Scope:

- landlord/admin manual screening request and status workflow
- applicant consent status
- manual review result recording
- audit trail
- no automated provider dependency

### Mission: Vacancy Publishing Feed/API

Branch: `feat/vacancy-publishing-feed-api-v1`

Scope:

- landlord-controlled vacancy publish state
- public-safe vacancy projection
- embeddable feed or API endpoint
- no tenant PII
- no raw internal IDs as user-facing labels

### Mission: Tenant Renewal-To-Vacancy Pipeline

Branch: `feat/tenant-renewal-to-vacancy-pipeline-v1`

Scope:

- renewal decision states
- pending vacancy state
- publish eligibility
- lease end and availability date rules
- landlord approval before public exposure

## Phase 3: Enterprise Operations

Purpose: expand operational depth after revenue-critical wedges are underway.

### Mission: Accounting Export/Integration Planning

Branch: `feat/accounting-export-framework-v1`

Scope:

- chart/account mapping strategy
- rent ledger export format
- payment reconciliation export
- Yardi/QuickBooks/CSV adapter planning
- no live accounting write integration initially

### Mission: Portfolio Reporting

Branch: `feat/enterprise-portfolio-reporting-v1`

Scope:

- enterprise KPIs
- portfolio vacancy and occupancy
- leasing pipeline
- rent/payment status summaries
- operational issue summaries
- export-safe reporting views

### Mission: Bulk Operations

Branch: `feat/enterprise-bulk-operations-foundations-v1`

Scope:

- bulk action job model
- dry-run and confirmation pattern
- audit events
- failure report
- no unsafe direct mass mutation

### Mission: Advanced Permission Templates

Branch: `feat/enterprise-permission-templates-v1`

Scope:

- predefined enterprise templates
- property and workspace scope
- explicit deny behavior
- no raw custom permission builder

### Mission: Organizational Hierarchy

Branch: `feat/enterprise-organization-hierarchy-foundations-v1`

Scope:

- ownership group model
- legal entity labels
- property-to-entity mapping
- relationship to PM companies
- reporting boundaries

## Phase 4: Institutional Differentiation

Purpose: use RentChain's governance and evidence posture as the strategic differentiator.

### Mission: Evidence Packages

Branch: `feat/enterprise-evidence-packages-v1`

Scope:

- lease/payment/screening/maintenance evidence bundles
- metadata-only summaries
- tenant/privacy redaction
- append-safe audit references

### Mission: Board/Tribunal Workflows

Branch: `feat/board-tribunal-workflow-packages-v1`

Scope:

- jurisdiction-aware package structure
- manual review controls
- export warnings and disclaimers
- no legal outcome claims

### Mission: Policy/Compliance Orchestration

Branch: `feat/enterprise-compliance-workflow-orchestration-v1`

Scope:

- workflow evidence requirements
- compliance task states
- responsible actor attribution
- escalation and review states

### Mission: Enterprise Audit Console

Branch: `feat/enterprise-audit-console-v1`

Scope:

- searchable audit views
- filters by actor/company/property/relationship
- export-safe audit package
- no raw provider payload exposure

### Mission: Government/Institutional Export Readiness

Branch: `docs/government-institutional-export-readiness-v1`

Scope:

- legal/privacy readiness audit
- recipient identity requirements
- revocation and retention rules
- non-authority semantics
- no live government integration

## Execution Notes

The next implementation mission should not be a broad enterprise UI.

Recommended immediate next step:

```text
docs/enterprise-pricing-and-packaging-v1
```

Reason: enterprise strategy needs packaging, price posture, and entitlement boundaries before sales, PAD, screening, and API work are represented as commitments.
