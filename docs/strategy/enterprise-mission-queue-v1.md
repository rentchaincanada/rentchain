# Enterprise Mission Queue v1

Branch: `docs/enterprise-layer-roadmap-v1`
Scope: proposed mission queue only; no implementation authorization.

## Queue Principles

Enterprise missions should:

- stay PR-sized
- preserve backend authority and projection safety
- avoid broad rewrites
- start with documentation or research when external providers, pricing, or compliance are involved
- avoid claiming Yardi replacement readiness
- preserve tenant and landlord privacy boundaries
- keep PM company and delegated access governance intact

## Recommended Mission Queue

### 1. Enterprise Pricing And Packaging

Branch: `docs/enterprise-pricing-and-packaging-v1`

Scope:

- audit canonical pricing, entitlements, and plan mappings
- define Free, Professional, and Enterprise packaging
- document `$30/unit/year` benchmark as market reference
- identify add-ons for PAD, screening automation, API access, and onboarding
- no billing implementation

### 2. PAD Payments Canada Provider Research

Branch: `research/pad-payments-canada-provider-options-v1`

Scope:

- compare Canadian PAD/provider options
- document tenant mandate requirements
- identify reconciliation and return handling
- assess Stripe/Trustly/bank rail compatibility if applicable
- recommend safe implementation path

### 3. Vacancy Publishing Feed/API

Branch: `feat/vacancy-publishing-feed-api-v1`

Scope:

- landlord-controlled vacancy publish state
- vacancy and pending-vacancy projection
- embeddable feed or API
- public-safe listing fields only
- no tenant PII

### 4. Manual Screening Workflow From Applications

Branch: `feat/applications-manual-screening-workflow-v1`

Scope:

- manual screening request state
- applicant consent tracking
- landlord/admin review state
- screening status visibility
- audit events
- no automated provider requirement

### 5. Automated Screening From Applications Add-On

Branch: `feat/applications-automated-screening-add-on-v1`

Scope:

- provider handoff from application
- paid add-on gating
- consent and disclosure UX
- provider callback normalization
- manual review fallback

### 6. PAD Payment Authorizations

Branch: `feat/pad-payment-authorizations-v1`

Scope:

- tenant authorization record
- payment schedule intent
- cancellation/amendment lifecycle
- consent/audit record
- provider-neutral mandate reference

### 7. Tenant Renewal-To-Vacancy Pipeline

Branch: `feat/tenant-renewal-to-vacancy-pipeline-v1`

Scope:

- renewal state model
- pending vacancy state
- availability date handling
- landlord approval before public vacancy publishing
- no automatic public exposure without publish control

### 8. Enterprise Portfolio Reporting

Branch: `feat/enterprise-portfolio-reporting-v1`

Scope:

- portfolio-level operating KPIs
- vacancy/occupancy reporting
- leasing pipeline reporting
- rent/payment summary reporting
- export-safe views

### 9. Accounting Export Framework

Branch: `feat/accounting-export-framework-v1`

Scope:

- accounting export contract
- ledger/payment mapping
- CSV-first export
- adapter planning for Yardi/QuickBooks-style systems
- no live external write integration

### 10. Enterprise API Key Management

Branch: `feat/enterprise-api-key-management-v1`

Scope:

- scoped API keys
- API key lifecycle
- rate limits
- audit events
- read-only first surface

### 11. Enterprise Organization Hierarchy Foundations

Branch: `feat/enterprise-organization-hierarchy-foundations-v1`

Scope:

- ownership group model
- legal entity labels
- property groups
- reporting hierarchy
- PM company relationship compatibility

### 12. Enterprise Bulk Operations Foundations

Branch: `feat/enterprise-bulk-operations-foundations-v1`

Scope:

- bulk job model
- dry-run preview
- confirmation
- per-record failure reporting
- audit trail

### 13. Enterprise Audit Console

Branch: `feat/enterprise-audit-console-v1`

Scope:

- searchable audit view
- actor/company/property filters
- export-safe audit packages
- no raw sensitive payloads

## Recommended Next Mission

Start with:

```text
docs/enterprise-pricing-and-packaging-v1
```

Reason:

Enterprise work now has enough product signal to justify packaging strategy, but not enough commercial clarity to safely start PAD, screening automation, or enterprise API implementation as committed product features.

## Deferred Missions

Do not start yet:

- full Yardi replacement roadmap
- live accounting write integration
- public trust profiles
- contractor organization enterprise workflows
- custom permission builder
- automated legal or tribunal submission
- production PAD provider integration before research
