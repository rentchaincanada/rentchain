# Enterprise Readiness Audit v2

Status: strategic audit only; no runtime or commercial change

Audit date: 2026-07-16

## Executive Summary

RentChain can credibly demonstrate a modern, governed rental-operations layer today. It has useful foundations across applications, screening workflows, leases, maintenance, landlord/tenant/contractor experiences, payments, ledgers, evidence, exports, delegated access, and property-manager-company authority. Those foundations support a narrow, supervised pilot, but they do not yet support a claim of enterprise-suite or 3,000-unit production readiness.

The recommended enterprise wedge is:

> Applications + screening readiness + lease workflow + maintenance coordination + tenant/contractor portals + evidence records + a PAD rent-collection roadmap.

RentChain should coexist with Yardi or another property-management system first. PAD is the most important missing revenue-critical capability. Full property accounting, accounts payable, utility/asset management, property sales, generalized customization, and full PMS replacement should remain outside the near-term build.

## Evidence And Claim Boundaries

This audit reconciles current product code with existing strategy and architecture documents. It does not certify scale, security, compliance, or production readiness.

- Current card-based Stripe rent-payment paths and provider-boundary foundations are not PAD.
- The existing `papMandates` / PAP scheduler prototype emits attempted-payment events; it does not execute a bank debit, reconcile settlement, handle returns, or satisfy a production mandate lifecycle.
- Certn appears as a workflow candidate marked `coming_soon` and `live: false`. It is not an active provider integration.
- TransUnion-oriented and manual screening paths exist, but availability depends on configuration and each workflow still needs enterprise operational validation.
- Payment-obligation and ledger-readiness models are useful foundations, not an automated receivables or accounting system.
- No current evidence establishes performance or operating readiness at 3,000 units.

## Readiness Definitions

| Label | Meaning |
| --- | --- |
| Demo-ready | Can be shown with curated data and an explicit statement of limitations. |
| Pilot-ready | Can be used in a narrow, supervised, reversible pilot with named support owners. |
| Partial | Foundations exist, but scale, workflow completeness, support, or controls are missing. |
| Missing | No production-ready capability was identified. |

## Category Audit

| Category | Capability | Readiness | Current evidence | Enterprise gap |
| --- | --- | --- | --- | --- |
| Management | Properties, units, rooms/amenities | Partial / pilot candidate | Property and unit services and landlord surfaces exist. | Bulk import/edit, hierarchy, portfolio segmentation, scale tests, richer amenity/community model. |
| Management | Pricing strategies, property sales | Missing | No enterprise-ready native capability identified. | Defer; integrate/export rather than build now. |
| Management | Workflows/customization | Partial | Governed lifecycle, decision, review, and automation foundations exist. | No safe general workflow builder, templates, or enterprise administration. |
| Management | Dashboards/reports/unified view | Demo-ready, partial | Dashboard, operations, portfolio, tenant, property, and report surfaces exist. | KPI contracts, pagination, bulk triage, scheduled reports, scale and reconciliation proof. |
| Finance | Rent ledger and payment records | Demo-ready, partial | Lease ledger, manual payments, card rent-payment execution, reconciliation/read-model foundations. | Automated obligations, PAD, returns, payouts, close/reconciliation controls. |
| Finance | Property accounting, income/expense | Partial | Narrow ledger/export and maintenance cost/expense links exist. | Chart of accounts, journal/close, bank reconciliation, entity accounting, audit-ready financial reports. |
| Finance | Vendors and accounts payable | Partial / missing | Contractor and maintenance foundations exist. | Vendor master, invoices, approvals, disbursements, tax and AP controls. |
| Leasing | Applications and acquisition | Demo-ready / narrow pilot | Public/manual application and review surfaces exist. | Portfolio configuration, bulk operations, SLAs, exception queues, scale testing. |
| Leasing | Screening | Demo-ready, partial | Consent/status, manual and TransUnion-oriented provider foundations, payment/order primitives. | Certn is not live; provider contracts, end-to-end QA, support and compliance packaging remain. |
| Leasing | Leases, renewals, move-in/out | Demo-ready, partial | Lease creation/signing/document, lifecycle, notice, renewal and move-in readiness foundations. | High-volume exceptions, reliable renewal-to-vacancy continuity, migration and bulk operations. |
| Leasing | Rent collection | Card demo only; PAD missing | Stripe-oriented card checkout, rent-payment records, webhook normalization foundations. | Mandates, bank verification, scheduling, ACSS initiation, returns, retry, payout and reconciliation. |
| Maintenance | Requests and work coordination | Demo-ready / narrow pilot | Landlord, tenant and contractor request/job surfaces; state and cost foundations. | Planning/scheduling, SLA queues, vendor governance, asset/utility programs and scale reporting. |
| Portals | Landlord/PM portal | Demo-ready / narrow pilot | Landlord operations, delegated access and PM-company relationship/staff foundations. | Enterprise hierarchy, permission templates, bulk administration, support tooling. |
| Portals | Tenant portal | Demo-ready / narrow pilot | Lease, payment, ledger, message, notice, screening, document and maintenance surfaces. | Mass onboarding/recovery, PAD authorization, accessibility/support and scale proof. |
| Portals | Contractor portal | Demo-ready / narrow pilot | Invite, profile, dashboard and jobs foundations exist. | Vendor onboarding, insurance/compliance, scheduling, invoicing and SLA reporting. |
| Portals | Community manager portal | Future | Adjacent PM/delegate patterns could support it later. | Do not create another role model until real customer authority needs are validated. |

## What RentChain Can Demo Today

Use seeded or explicitly approved demo data to show one coherent path:

1. Set up a property/unit and review the portfolio workspace.
2. Receive and review an application.
3. Explain consent-preserving screening options; show only a configured live path or manual fallback, and label Certn as future.
4. Create/review a lease and move-in readiness context.
5. Show tenant portal records, messages/notices, documents, ledger/payment visibility, and maintenance intake.
6. Route maintenance work to a contractor surface.
7. Show evidence/audit/export posture and role-governed access.
8. Present PAD as the next designed module, never as live functionality.

## What Is Pilot-Ready

A pilot should be limited to a selected property group, named users, capped record volumes, supervised onboarding, manual exception handling, and a documented rollback/export path. Reasonable pilot candidates are applications, lease workflow, tenant/contractor coordination, maintenance, and evidence records after environment-specific QA. Card payment or screening flows may join only when provider configuration, consent, support ownership, and end-to-end testing are confirmed.

PAD, 3,000-unit portfolio-wide migration, full accounting, and unattended automation are not pilot-ready.

## Minimum Enterprise Wedge At $30 Per Unit Per Year

At a reference price of `$30/unit/year`, the minimum credible annual package should solve an operating problem, not merely unlock existing screens. It should include:

- governed applications-to-lease workflow;
- tenant and contractor participation;
- maintenance coordination and exception visibility;
- evidence/audit records and practical exports;
- enterprise onboarding, roles, and named support;
- a contracted PAD delivery path or a production PAD module once released;
- integration-friendly exports so the existing PMS remains authoritative where required.

Before PAD is live, `$30/unit/year` is most defensible as a negotiated pilot-to-production price tied to explicit milestones, not a blanket public claim.

## What Must Be Built Next

For a serious 3,000-unit conversation, the next work should be:

1. Pilot packaging, demo script, success measures, data-processing boundaries, support model, and architecture questionnaire.
2. PAD provider selection and legal/compliance design.
3. A narrow PAD beta: mandate to scheduled obligation to debit evidence to receipt/failed-payment record.
4. Portfolio-scale import previews, validation, idempotent apply, and reconciliation reports.
5. Bulk/exception operations, pagination and measured scale tests on the chosen pilot workflows.
6. Screening packaging with a proven provider path; Certn only after an authorized integration mission.

## Do Not Build Yet

- A full Yardi/RIOO clone or general ledger.
- Native accounts payable, payroll, procurement, property sales, or utility billing.
- A generic no-code workflow engine.
- Direct funds custody or an internal payment rail.
- Autonomous collections, eviction, screening decisions, or retry logic.
- A new community-manager role before authority requirements are validated.
- One-off Yardi coupling before a canonical import/export contract exists.

## Prefer Integration Over Native Scope

Keep general ledger/accounting, AP, payroll, tax, utility metering, property sales, bank connectivity, background/credit data, electronic signature, and mature PMS recordkeeping behind governed provider or export/import boundaries. RentChain should own workflow context, authorization, evidence, projections, exceptions, and reconciliation—not recreate every upstream system.

## Advantages RentChain Already Has

- Modern tenant-facing and cross-role workflow direction.
- Server-side authority and projection-safe design principles.
- Append-safe evidence, review, canonical-event, and export foundations.
- Provider boundaries and manual-review posture rather than hidden automation.
- A coexistence-friendly architecture that can add value without a big-bang PMS replacement.

## Risks And Dependencies

| Risk | Consequence | Control |
| --- | --- | --- |
| Full-suite ambition | Years of accounting and operational scope before revenue proof. | Sell a bounded wedge beside the incumbent PMS. |
| Prototype overclaim | A demo artifact is mistaken for payment capability. | Maintain explicit current/partial/future labels. |
| Unproven scale | Slow queries, unusable single-record workflows, export failures. | Benchmark realistic volumes; add pagination, bulk controls and SLOs. |
| Split source of truth | Rent, lease or tenant status conflicts across systems. | Declare field ownership and reconciliation rules per integration. |
| Payment/compliance error | Unauthorized debits, poor notices, regulatory exposure. | Processor-led flow, counsel review, fail-closed states and immutable evidence. |
| Migration failure | Buyer cannot reconcile imported data or safely roll back. | Preview, validation, idempotency, parallel run and signed reconciliation. |
| Support underinvestment | Operational exceptions overwhelm a small team. | Named pilot support, severity model, runbooks and capacity limits. |

## Strategic Answer

RentChain should not replace Yardi first. It should become the modern workflow, screening-readiness, maintenance, tenant/contractor, evidence, and PAD layer beside it. Success is a low-friction, measurable enterprise pilot that preserves the incumbent source of truth while proving a revenue-critical workflow.
