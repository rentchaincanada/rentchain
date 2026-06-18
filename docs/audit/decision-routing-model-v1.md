# Decision Routing Model V1

## Scope

This document defines which workspace owns each landlord-facing decision, warning, review state, upcoming action, and critical issue.

It is a documentation-only routing model for future Dashboard 2.0 and Operations work. It does not change routes or UI behavior.

## Routing Principles

1. The decision queue owns prioritization, not all content.
2. The source workspace owns resolution.
3. Dashboard owns summarization and preview only.
4. Operations owns full triage and cross-domain filtering.
5. Detail workspaces own domain-specific context, evidence, and final action.
6. Tenant portal state can inform landlord decisions but should not become a landlord decision destination unless landlord action is required.

## Workspace Ownership

| Workspace | Owns | Should not own |
| --- | --- | --- |
| Dashboard | Portfolio health, top critical items, today's next actions, financial snapshot, upcoming preview. | Full review workflow, detailed lease/payment/tenant troubleshooting. |
| Operations | Canonical Decision Queue, cross-domain triage, filters, saved operational views, unassigned/escalated lanes. | Source-specific editing forms or long domain guidance. |
| Decision Inbox | Lower-level derived decision list and workflow routing engine. | User-facing operational home if Operations becomes the canonical queue. |
| Properties | Property/unit readiness, occupancy source context, action requests, unit-level conflicts. | Lease execution detail, tenant move-in checklist, payments. |
| Tenants | Tenant lifecycle, current lease linkage, move-in readiness, tenant portal readiness, tenant-specific state coherence. | Portfolio-wide decisions or unrelated lease/payment queues. |
| Tenant Profile | One tenant's current blockers, linked lease/unit, move-in progress, tenant communications/readiness. | Global decision prioritization. |
| Leases | Lease execution, document generation/signing, Form P readiness, payment readiness, delivery readiness, lease lifecycle. | Tenant portal activation except as linked readiness context. |
| Lease Workflow Pages | Focused execution, rent increase, notice, deposit, renewal, and move-out reviews. | General lease summary replacement or legal advice. |
| Payments/Ledger | Delinquency, payment evidence, failed or missing payments, payment setup readiness. | Lease document execution or tenant move-in readiness. |
| Maintenance | Submitted requests, assignment, scheduling, in-progress work, completion, cost review. | Lease lifecycle or payment obligation decisions. |
| Notices | Notice preparation, response deadlines, renewal/move-out responses, no-response review. | Full lease status or tenant profile state. |
| Tenant Portal | Tenant-facing status, tasks, documents, payments, maintenance, communication, and trust views. | Landlord's authoritative decision queue. |

## Canonical Route Ownership By Decision Type

| Decision or signal | Canonical owner | Preferred destination | Dashboard treatment | Operations treatment |
| --- | --- | --- | --- | --- |
| Overdue rent | Payments/Ledger | `/leases/:leaseId/ledger` or payment workspace | Critical preview | Critical queue item |
| Failed payment | Payments/Ledger | `/leases/:leaseId/ledger` or payment workspace | Critical preview | Critical queue item |
| Underpaid or partial payment | Payments/Ledger | `/leases/:leaseId/ledger` | Warning preview if material | Warning queue item |
| Manual payment review | Payments/Ledger | `/leases/:leaseId/ledger` | Needs review count | Needs Review queue item |
| Missing rent terms | Leases | `/leases` or `/leases/:leaseId/summary` | Warning only when blocking next action | Lease readiness item |
| Payment setup not enabled | Leases/Payments | `/leases/:leaseId/ledger` | Warning only if landlord is trying to collect rent | Payment readiness item |
| Lease active before execution | Leases | `/leases/:leaseId/summary` | Critical preview | Critical queue item |
| Occupied unit without active executed lease | Properties/Leases | `/leases/:leaseId/summary` if lease exists; otherwise property/unit workspace | Critical preview | Critical queue item |
| Active lease on vacant unit | Properties/Leases | `/leases/:leaseId/summary` or `/properties` | Critical or Warning preview | Queue item |
| State coherence needs review | Owning source workspace | Source workspace based on conflict | Needs review preview | Needs Review queue item |
| Lease signature pending | Leases | `/leases` or lease signing panel | Warning only if blocking move-in | Documents/lease item |
| Primary lease document unavailable | Leases | `/leases` | Warning only if signing is expected | Documents/lease item |
| Signed lease available | Leases | governed document action | Informational/activity | Not queued |
| Form P readiness incomplete | Leases | `/leases` signing/document panel | Warning if signing/use is blocked | Lease readiness item |
| Email service consent missing | Leases | `/leases` Form P readiness | Warning if lease generation/signing context | Lease readiness item |
| Signed lease delivery pending | Leases | `/leases` delivery readiness | Warning if post-signing delivery needed | Lease readiness item |
| Act copy/link delivery pending | Leases | `/leases` delivery readiness | Warning if lease package generated/signed | Lease readiness item |
| Lease expiring soon | Leases/Notices | `/leases/:leaseId/workflows/renewal` or notice workflow | Upcoming | Upcoming item |
| Notice due or response deadline | Notices/Leases | `/leases/:leaseId/workflows/notice` | Upcoming or Warning when close | Upcoming/Warning queue item |
| No renewal response | Notices/Leases | `/leases/:leaseId/workflows/notice` | Warning preview | Needs Review queue item |
| Tenant move-in lease signature pending | Tenants/Leases | tenant profile or lease signing panel | Warning only if move-in window active | Needs Review item scoped to tenant |
| Tenant portal invite pending | Tenants | tenant profile | Informational or Warning if required for move-in | Tenant readiness item |
| Tenant portal activation pending | Tenants | tenant profile | Informational unless blocking workflow | Tenant readiness item |
| Submitted maintenance request | Maintenance | maintenance workspace | Warning if unreviewed | Needs Review queue item |
| Maintenance blocked/cancelled needs attention | Maintenance | maintenance request detail | Critical or Warning | Queue item |
| Maintenance in progress | Maintenance | maintenance workspace | Informational | Not queued unless late/stalled |
| Maintenance cost approval incomplete | Maintenance/Expenses | work order cost review | Warning | Needs Review queue item |
| Screening provider/setup blocked | Applications/Screening | `/applications` | Critical if screening is primary next step | Screening review item |
| Screening review needed | Applications/Screening | application/screening workflow | Warning | Screening review item |
| Applicant funnel empty | Applications | `/applications` | Upcoming/action prompt | Not a critical queue item |
| Add property/unit onboarding | Properties | `/properties` | Upcoming/action prompt | Not decision queue |

## Routing Fallbacks

| Condition | Fallback |
| --- | --- |
| Lease-scoped item lacks a safe lease workspace destination | Route to `/leases` with contextual copy. |
| Tenant-scoped item lacks a current lease | Route to tenant profile. |
| Property/unit conflict lacks lease context | Route to `/properties`. |
| Payment item lacks ledger context | Route to payment workspace or `/leases` only if no payment route is available. |
| Source is derived analytics without a safe entity destination | Route to Operations detail/decision inbox, not a raw ID label. |

## Dashboard Versus Operations Routing

Dashboard should display:

- Top 3 Critical Issues.
- Today's Upcoming Actions.
- Portfolio status summary.
- Financial snapshot.
- Link to full Operations queue.

Dashboard should not display:

- Every warning.
- Full decision filters.
- Long explanations.
- Duplicate lease/tenant readiness panels.

Operations should display:

- Full normalized queue.
- Severity filters.
- Domain filters.
- Owner/unassigned/escalated views.
- Links into the owning workspace for resolution.

Operations should not display:

- Source-specific edit forms.
- Long legal/workflow guidance better handled by lease workflow pages.
- Duplicate dashboard KPI cards.

## Missing Routing Decisions

| Gap | Recommendation |
| --- | --- |
| Decision Inbox and Operations overlap | Treat Operations as landlord-facing canonical queue. Treat Decision Inbox as engine/detail surface or consolidate behind Operations. |
| Dashboard actions and decisions overlap | Keep onboarding/activation actions separate from the Decision Queue. |
| Lease and tenant profiles both emit readiness warnings | Choose the source workspace by resource ownership: lease execution belongs to Leases; move-in readiness belongs to Tenants. |
| Maintenance does not appear fully integrated into decision inbox | Add maintenance submitted/blocked/cost-review generators to canonical queue in a future implementation mission. |
| Notices and lease expiry appear in dashboard/lease views but not consistently in decision inbox | Promote near-deadline and missed-response notice items into Upcoming/Warning queue lanes. |
| Property action requests are separate from Operations | Map open property action requests into Operations as property-owned Needs Review items. |

## Non-Goals

- This model does not create new routes.
- This model does not remove `/decision-inbox`.
- This model does not implement Dashboard 2.0.
- This model does not alter auth, projection, or queue persistence.

