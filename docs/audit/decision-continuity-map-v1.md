# Phase 2 Decision Continuity Map V1

## Scope

This document maps decision continuity across review workflows observed for Phase 2 Mission 1. It focuses on where decisions originate, how state is persisted, what evidence survives reloads, what remains local to the browser, and where future hardening may be needed.

This is a documentation-only audit. It does not modify routes, services, auth, billing, screening adapters, Firestore rules, Terraform, CI/CD, dependencies, or production data.

## Continuity Model

| Continuity layer | Meaning | Examples observed |
| --- | --- | --- |
| Derived read model | State is calculated from source records at request time. | Review timeline, evidence preview, audit readiness, decision inbox, lifecycle review queue. |
| Current-state record | Latest status is stored in a mutable or replacing record. | Decision action state, lease status, work order status, screening operation status, payment status. |
| Append history | Each transition records an event or history entry. | Canonical events, screening events, lease workflow events, maintenance status history, work order updates, audit events, payment events. |
| Browser-only state | State exists only in React component state until submit or navigation. | Filters, selected records, in-progress forms, modal fields, unsaved notes, scheduling fields. |
| URL state | Review context survives reload through route params or query params. | Review timeline scope filters, support operations status filter, lease ledger lease route parameter. |

## Screening Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Screening request/run | Screening routes and screening orchestration services | Application status, screening order, screening transaction status | Screening event records | APPEND-SAFE lifecycle evidence exists alongside current application/order state. |
| Checkout | Screening checkout route and payment transaction service | Payment transaction status | Transaction lifecycle records and screening events | Payment status continuity exists, but provider-facing data requires projection checks. |
| Completion/failure | Admin result routes and orchestration service | Application screening status and screening result | Screening event records | APPEND-SAFE event evidence exists for completed and failed transitions. |
| History/detail/report | Screening history service and report routes | Derived normalized history and report availability | Application, order, result, and event sources | PROJECTION CONCERN: report views require continued payload redaction verification. |
| Admin operation review | Screening operations routes and service | Operation status and detail | Operation status plus screening/application records | CONTINUITY GAP: in-progress admin review form values are browser-only until submit. |

## Lease And Document Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Lease create/update/end/restore | Lease routes and lease services | Lease current status and fields | Audit and workflow-related events where implemented | CURRENT STATE lease records are supported by selected event history. |
| Lease lifecycle review | Admin lease lifecycle review page/API and backend lifecycle derivation | Review acknowledgement and decision action state | Recent history and derived decision context | Mixed derived review state and persisted acknowledgement/action records. |
| Lease notices | Tenant and landlord lease notice routes, lease notice workflow service | Notice state, lease status updates | Lease workflow events | APPEND-SAFE notice lifecycle continuity. |
| Lease documents and URLs | Lease document URL routes and document surfaces | Document reference state | Document metadata and audit history where available | PROJECTION CONCERN: document URL and storage-reference projection requires continued verification. |
| Lease ledger | Lease ledger routes and ledger UI | Ledger entries and current modal outcomes after submit | Ledger exports and payment/charge records | CONTINUITY GAP: in-progress charge/payment/note modal state is browser-only. |

## Maintenance Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Request intake | Tenant/landlord maintenance routes | Work order current status and request fields | Status history and request metadata | CURRENT STATE request with append history. |
| Landlord review and assignment | Maintenance workflow routes and frontend workspace | Status, contractor assignment, priority, notes after submit | Status history and work order updates | CONTINUITY GAP: notes, contractor selection, access, and scheduling fields are browser-only until submit. |
| Scheduling and confirmation | Maintenance schedule and confirmation routes | Schedule fields and confirmation status | Confirmation history and updates | APPEND-SAFE history exists for completed transitions. |
| Cost review | Maintenance cost routes and approval execution service | Cost review status and cost fields | Cost review history and work order updates | APPEND-SAFE review history supports current cost state. |
| Completion/rework | Maintenance completion and rework routes | Work order final or rework status | Status history and updates | APPEND-SAFE lifecycle evidence for completed transitions. |

## Payment And Ledger Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Payment list | Payment route and payment service | Payment record state | Payment events where available | Read model depends on current payment records and event history. |
| Rent checkout lifecycle | Rent payment service | Payment intent and rent payment status | Payment intent and rent payment events | APPEND-SAFE payment events support current status. |
| Lease ledger charge/payment | Lease ledger routes | Ledger entry records | Ledger export and payment history | CURRENT STATE ledger records; export activity needs continued projection verification. |
| Payment exports | Payment export routes | Export output generated on demand | Export events where implemented | PROJECTION CONCERN: exports need continued verification for safe identifiers and provider references. |

## Decision Review Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Decision derivation | Decision routes and decision inbox derivation | No separate source record for derived item | Source lease, payment, maintenance, compliance, and event records | Derived decisions are reproducible from current sources. |
| Decision appearance | Decision appearance event service | Canonical event for new decision appearance | Canonical events | APPEND-SAFE appearance evidence. |
| Decision action | Decision action route and landlord decision state service | Current action record keyed by decision | Decision action record plus timeline derivation | CONTINUITY GAP: action state is separate from derived decision source and is stored as current state. |
| Decision timeline | Landlord review timeline route and decision history service | Derived timeline view | Canonical events, action state, source records | Read-only continuity surface with URL-based scope context. |

## Governed Review Workspace Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Workspace list/detail | Admin review workspace route and read service | Governed review workspace metadata | Safe evidence refs, append event refs, related workspace links | APPEND-SAFE metadata model for admin review context. |
| Workspace UI review | Admin review workspace page and review workspace components | Filters, selected item, detail, local status/assignment controls | Backend workspace metadata | CONTINUITY GAP: manual status and assignment controls are local UI metadata in observed components. |
| Support escalation linkage | Support escalation route/service | Escalation metadata and history count | Related governed review workspace metadata | PROJECTION CONCERN: future escalation writers must preserve metadata-only detail boundaries. |

## Compliance, Support, And Governance Continuity

| Stage | Source route/service | Persisted state | Evidence | Continuity result |
| --- | --- | --- | --- | --- |
| Audit readiness | Audit compliance route and compliance derivation service | Derived readiness only | Audit events, decisions, payments, leases, properties, maintenance | Read-only derivation; links to evidence and timeline previews. |
| Compliance rules | Compliance route and engine | Rule data | Rule source data | Read-only rule lookup. |
| Support operations | Support operations route/page | Derived support profile | Observability, status, and alert sources | Read-only profile continuity. |
| Support resource access | Support console route | Access event | Audit event record | APPEND-SAFE read access evidence. |
| Release governance | Release governance routes/page | Review governance records | Release governance artifacts and audit context | Review continuity depends on upstream release governance records. |

## Frontend State Continuity

| State type | Surfaces | Persistence behavior |
| --- | --- | --- |
| URL-carried state | Review timeline, support operations, route-parameter pages | Survives reload and can be shared internally when authorization allows. |
| Server-persisted action state | Decision actions, lease notice responses, screening operations, maintenance transitions, payment checkout status | Survives reload after successful API response. |
| Browser-only filters | Decision inbox, admin review workspaces, support escalations, screening queues, lease pages, maintenance pages | Usually resets on navigation unless also represented in URL. |
| Browser-only form drafts | Screening operation details, lease ledger modals, maintenance scheduling/cost forms, lease conversion/payment rail forms | CONTINUITY GAP: draft state may be lost before submit. |

## Projection Boundary Notes

| Boundary | Current posture | Follow-up category |
| --- | --- | --- |
| Tenant-facing review inputs | Phase 1 hardening established tenant-safe projections for core tenant surfaces. | Continue verifying when tenant data is reused in landlord/admin review contexts. |
| Landlord review surfaces | Landlord routes generally require authenticated landlord context and ownership checks. | Verify derived evidence and timeline sections do not expose admin-only or tenant-private details. |
| Admin/support review surfaces | Admin routes require admin permission and emphasize metadata-only review. | Preserve metadata-only pattern before adding writers or external exports. |
| Provider and payment references | Screening, report, checkout, and payment export surfaces touch external-provider-adjacent data. | PROJECTION CONCERN for future report/export hardening missions. |
| Document and storage references | Lease documents and generated URLs are review inputs. | PROJECTION CONCERN for any future external evidence package or export work. |

## Failure And Recovery Map

| Failure mode | Current recovery behavior | Gap status |
| --- | --- | --- |
| Reload during review queue filtering | Server data reloads; local filters may reset unless URL-backed. | CONTINUITY GAP for non-URL filters. |
| Reload during unsaved form entry | Submitted server state survives; unsaved draft values are lost. | CONTINUITY GAP for form drafts. |
| Decision source data changes after action state | Derived decision may change while action record remains separate. | CONTINUITY GAP for action/source reconciliation. |
| Report or export generation failure | Route-specific error responses and status fields surface failures. | PROJECTION CONCERN for safe failure payloads. |
| Maintenance or payment provider callback delay | Current state remains pending until callback or service update. | APPEND-SAFE payment and work order events help reconstruct activity where emitted. |

## Future Mission Candidates

These candidates are audit observations, not implementation instructions for this mission:

1. Add persisted draft continuity for high-risk review forms where losing browser-only state could interrupt operational review.
2. Add explicit reconciliation metadata between derived decisions and stored decision action records.
3. Extend projection verification for screening reports, payment exports, ledger exports, and document URL review surfaces.
4. Add backend persistence for governed review workspace status and assignment metadata if those controls become operational requirements.
5. Normalize URL-carried filter state across review queue surfaces where reload continuity is required.

## Phase 2 Continuity Result

Review continuity is strongest where source transitions emit append history and where read models derive deterministic review context from existing records. Continuity is weakest where frontend forms hold operational review context locally before submit, and where derived decisions are paired with separate current-state action records.

No runtime defects are fixed by this audit. The observed gaps should be handled through separately scoped hardening missions.
