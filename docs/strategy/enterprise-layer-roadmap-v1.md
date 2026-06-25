# Enterprise Layer Roadmap v1

Branch: `docs/enterprise-layer-roadmap-v1`
Scope: strategic roadmap only; no implementation.

## Purpose

This roadmap translates enterprise landlord feedback into a tiered product strategy for RentChain.

It does not change pricing, entitlements, billing, routes, Firestore schema, payment providers, or screening providers.

## Tier Strategy

RentChain should preserve a simple adoption path while making enterprise needs explicit.

### Free Tier

Purpose: small landlord onboarding, product education, and low-risk workflow trial.

Expected posture:

- guided setup
- limited portfolio size
- manual tenants and applications
- basic lease and tenant workflow visibility where currently supported
- pay-per-use or manually assisted screening paths where available
- basic portfolio health or operational summaries
- no enterprise API access
- no PAD automation
- no advanced role governance
- no bulk operations

Free tier should be honest about limits. It should help landlords understand RentChain's governance model, not imply enterprise readiness.

### Professional Tier

Purpose: active small to mid-size landlord operations.

Expected posture:

- tenant portal workflows
- applications, leases, maintenance, notices, messaging, and ledger workflows where supported
- delegated access
- property manager company relationships where enabled
- stronger reporting and exports
- operational dashboard and portfolio summaries
- manual screening workflow
- limited team access
- standard audit history
- no full accounting replacement
- no enterprise-grade API guarantees unless separately packaged

Professional tier should be the proving ground for governed workflows and operational depth.

### Enterprise Tier

Purpose: large portfolios, multi-entity operators, property management companies, and institutional-grade reporting.

Enterprise should include, after implementation:

- portfolio-scale role governance
- organization hierarchy
- property manager company support
- multi-entity ownership
- advanced audit logs
- bulk operations
- institutional reporting
- API access
- vacancy feed/API
- automatic pre-authorized debit or comparable payment automation
- screening automation
- accounting/export integrations
- compliance and workflow evidence
- custom onboarding and support

Enterprise is a governance and operations layer, not just a higher entitlement flag.

## Enterprise Capability Areas

### Portfolio-Scale Role Governance

Needed:

- organization-level roles
- landlord owner roles
- property manager company roles
- staff assignment and property scope
- explicit deny precedence
- server-side authorization only

Status: partial foundation exists through delegated access and property manager company work.

### Organization Hierarchy

Needed:

- ownership groups
- management companies
- regional/property groups
- staff teams
- multi-entity reporting boundaries

Status: mostly missing. Property manager company model provides a starting point but does not yet model full enterprise ownership hierarchy.

### Property Manager Company Support

Needed:

- landlord-company relationships
- company admin acceptance
- staff assignments
- landlord visibility
- scope ceilings
- audit events

Status: partially implemented and strategically important for enterprise workflows.

### Multi-Entity Ownership

Needed:

- legal entity labels
- portfolio ownership structure
- property-to-entity mapping
- reporting by entity
- export by entity

Status: missing.

### Advanced Audit Logs

Needed:

- actor, company, landlord, relationship, role, scope, target, outcome, timestamp
- searchable audit views
- exportable audit packages
- immutable history posture

Status: partial architecture and foundations exist; enterprise console and export workflows remain future work.

### Bulk Operations

Needed:

- bulk invite
- bulk update
- bulk notice
- bulk lease status actions
- bulk assignment operations
- import/export safeguards

Status: missing or limited.

### Institutional Reporting

Needed:

- portfolio dashboards
- operational KPIs
- vacancy and leasing reporting
- delinquency/payment reporting
- maintenance reporting
- audit/report export packages

Status: partial reporting foundations exist but not enterprise-grade.

### API Access

Needed:

- API keys
- scoped tokens
- rate limits
- audit logs
- versioned endpoints
- public-safe projections

Status: missing as a productized enterprise capability.

### Vacancy Feed/API

Needed:

- landlord-controlled publish state
- vacancy and pending-vacancy lifecycle
- safe listing projection
- embeddable feed or API
- no tenant PII
- no raw internal IDs as labels

Status: missing.

### PAD/Payment Automation

Needed:

- Canadian PAD provider research
- tenant authorization mandate
- payment scheduling
- failed payment handling
- reconciliation
- cancellation and amendment lifecycle
- support-safe audit

Status: missing; payment boundary foundations exist but PAD is not implemented.

### Screening Automation

Needed:

- manual screening first
- automated provider handoff from applications
- consent lifecycle
- screening result normalization
- review queue
- audit trail

Status: partial screening routes and architecture exist; enterprise workflow needs a dedicated mission sequence.

### Accounting/Export Integrations

Needed:

- rent ledger exports
- payment reconciliation exports
- accounting system mapping
- CSV/API export formats
- Yardi/QuickBooks/other integration research

Status: partial export architecture exists, but accounting integration is missing.

### Compliance/Workflow Evidence

Needed:

- evidence packages
- lease lifecycle evidence
- screening consent evidence
- payment authorization evidence
- audit export readiness
- board/tribunal workflows

Status: strong strategic fit; implementation remains partial across evidence and export foundations.

### Custom Onboarding/Support

Needed:

- tenant/property import plan
- staff onboarding
- enterprise QA environment
- support escalation runbook
- data migration review
- implementation success criteria

Status: mostly operational and process work still needed.

## Roadmap Position

Enterprise should be introduced only after the platform has clear foundations for:

1. packaging and entitlement boundaries
2. organization and authority modeling
3. PAD feasibility
4. vacancy publishing API safety
5. screening workflow control
6. accounting/export readiness

The first enterprise wedge should not try to replace Yardi Voyager. It should solve specific adoption blockers while preserving RentChain's modern governed workflow posture.
