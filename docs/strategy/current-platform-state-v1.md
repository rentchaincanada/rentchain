# Current Platform Strategic State v1

Branch: `docs/strategic-execution-plan-enterprise-readiness-v1`
Scope: strategic documentation only; no implementation.

## Purpose

This document consolidates RentChain's current platform state after the recent Delegated Access, Property Manager Company, and Enterprise roadmap work.

It separates current capability from future roadmap. It does not change pricing, entitlements, routes, Firestore schema, payments, screening, vacancy publishing, billing, or runtime behavior.

## Current Platform Posture

RentChain is shifting from construction mode into enterprise validation and execution planning.

RentChain should be positioned as a Governed Housing Operations Platform, not generic landlord software. The current strategic value is the governed connection between landlord operations, tenant workflows, delegated actors, property manager companies, evidence, audit, and revenue lifecycle execution.

The current platform has strong governance-first foundations:

- authenticated landlord, tenant, delegate, contractor, and property manager company account patterns
- landlord workspace operations
- tenant portal surfaces
- lease lifecycle and document workflows
- payment execution boundary foundations
- application and screening foundations
- Delegated Access V1
- Property Manager Company relationship and staff assignment foundations
- evidence, audit, and export architecture
- dashboard and operations direction

The platform is not yet an Enterprise layer. Enterprise remains a future advanced operational layer that requires onboarding, API access, advanced reporting, governance, integrations, implementation support, and customer-success process.

## Current Completed Capabilities

### Landlord Platform

Current landlord capabilities include property, tenant, lease, application, messaging, notice, operations, reporting, billing, account, delegated access, and PM company management surfaces.

Enterprise gap:

- large portfolio scale, bulk operations, entity hierarchy, and implementation support are not yet productized.

### Tenant Portal

Tenant portal foundations include tenant workspace, lease/payment-related views, messages, notices, screening status flows, and safe tenant-facing projections where implemented.

Enterprise gap:

- high-volume onboarding, recovery, PAD authorization, and support-safe tenant administration need dedicated hardening.

### Lease Workflows

Lease workflows include active leases, lease summaries, signed document retrieval paths, lease lifecycle signals, notice/renewal workflow pages, and tenant lease notice experiences.

Enterprise gap:

- renewal-to-vacancy-to-listing continuity is not yet a first-class revenue pipeline.

### Payments Foundation

RentChain has payment execution boundary architecture and current payment surfaces, including Stripe-oriented payment paths where implemented.

Enterprise gap:

- automatic pre-authorized debit is not implemented.
- Canadian PAD provider, mandate, consent, reconciliation, return, and support workflows need research and design before implementation.

### Applications And Screening Foundations

Application and screening foundations include application workflows, tenant screening consent/status architecture, manual review fallback concepts, and provider-oriented integration seams where present.

Enterprise gap:

- manual screening from applications needs productization.
- automated screening dispatch remains future paid add-on work and must not be represented as complete.

### Delegated Access

Delegated Access V1 supports landlord-owner invitation, delegate acceptance, delegate workspace, grants, revoke, history, and safe routing for non-owner delegates.

Enterprise gap:

- enterprise permission templates, reporting, mobile information architecture, and larger-scale history review remain future work.

### Property Manager Company Workflows

PM Company foundations now include:

- company identity and membership foundations
- landlord-company relationship APIs
- PM company acceptance
- staff assignment foundations and APIs
- management read APIs
- non-landlord PM company auth/profile support
- landlord and company-admin management UI

Enterprise gap:

- email notifications, timeline/history polish, assignment grouping, larger-scale visibility, and organization hierarchy integration remain future work.

### Evidence And Audit Foundations

RentChain has extensive evidence, audit, export, canonical event, and review architecture.

Enterprise gap:

- enterprise audit console, searchable audit review, audit exports, and workflow evidence packages remain future execution work.

### Operations And Dashboard Direction

Dashboard and operations surfaces provide the direction for portfolio overview, decision routing, command center, and operational review.

Enterprise gap:

- enterprise reporting, bulk operations, exception queues, and operational command center workflows need dedicated missions.

## Current Tiers

Current tiers remain:

- Free
- Starter
- Pro
- Elite

These tiers are the current commercial and capability model. Enterprise should not be inserted as a casual fifth standard tier without a pricing and entitlement audit.

## Enterprise As Future Layer

Enterprise should be treated as an advanced operational layer that sits above and across current tiers.

Enterprise should include, after implementation:

- enterprise onboarding
- API access
- advanced reporting
- portfolio-scale governance
- organization hierarchy
- PM company operations at scale
- delegated access at scale
- integrations
- implementation support
- operational success support
- audit and evidence packages

Enterprise is not complete today.

## Strategic State

RentChain's current strategic transition:

```text
foundation construction
  -> enterprise validation
  -> revenue workflow execution
  -> enterprise operational layer
```

The next quarter should prioritize stabilizing recently completed governance work, then advancing revenue-critical enterprise workflows: PAD readiness, screening, vacancy publishing, and lease-up continuity.
