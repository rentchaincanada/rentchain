# Phase 2 Review Workspace Map V1

## Scope

This inventory maps review workspace infrastructure observed in the current repository for Phase 2 Mission 1. It is a documentation-only audit of route surfaces, service boundaries, frontend entry points, evidence sources, authority boundaries, and continuity gaps.

No source route, service, auth, billing, screening adapter, Firestore rule, Terraform, CI/CD, dependency, or production data behavior is changed by this document.

## Method

Inspection covered backend route mounts, route handlers, read services, workflow services, and frontend pages/API helpers related to review workspaces, decisions, screening, leasing, maintenance, payments, compliance, support, release governance, evidence, and timelines.

The audit uses these labels:

- `CONTINUITY GAP`: a workflow or state transition has limited recovery, traceability, or cross-surface continuity.
- `PROJECTION CONCERN`: a read or UI surface requires follow-up verification for tenant-safe, landlord-safe, admin-safe, or support-safe projection behavior.
- `APPEND-SAFE`: source records preserve history through append events or immutable history entries.
- `CURRENT STATE`: source records keep a mutable latest-state record and may rely on adjacent event history for continuity.

## Backend Route Inventory

| Surface | Route area | Authority | Behavior | Continuity notes |
| --- | --- | --- | --- | --- |
| Admin review workspaces | `/api/admin/review-workspaces` | Authenticated admin permission | Lists and reads metadata-only governed review workspaces. | APPEND-SAFE metadata is exposed through safe evidence references and related workspace links. |
| Landlord review timeline | `/api/landlord/review-timeline` | Authenticated landlord | Derives chronological review history for supported scopes. | Read-only derivation from properties, leases, units, maintenance, payments, events, canonical events, decisions, and review sessions. |
| Decision list and action state | `/api/decisions` | Authenticated landlord with lease ownership check | Lists derived lease decisions and records action state. | CURRENT STATE action records are stored separately from derived decisions. |
| Landlord decision inbox | `/api/landlord/decision-inbox` | Authenticated landlord | Derives review queue and workflow preview data. | Read-only queue surface; continuity depends on decision state records and canonical events. |
| Landlord review sessions | `/api/landlord/operator-reviews` | Authenticated landlord | Opens review sessions, appends notes, closes sessions. | APPEND-SAFE canonical events are emitted for session lifecycle activity. |
| Screening user routes | `/api/screenings/*` | Authenticated account context for protected paths | Starts screening, requests screening, creates checkout, reads history, details, and reports. | APPEND-SAFE screening events supplement order/result records. |
| Screening operations | `/api/admin/screening-ops/*` and rental application screening operations | Admin or scoped account authority by route | Starts, completes, cancels, and reads screening operations. | CURRENT STATE operation records use status transitions; history is available through screening events and application status. |
| Verified screening review | `/api/admin/verified-screenings/*` and `/api/screening/report` | Authenticated account; admin for admin list/detail updates | Reads verified report data and admin review queue. | PROJECTION CONCERN: report views require continued verification that provider payloads remain summarized and redacted. |
| Lease lifecycle and documents | `/api/leases/*`, landlord lease routes, admin lease review routes | Authenticated landlord/admin depending on route | Edits leases, ends/restores leases, reads lifecycle review, ledger, documents, and exports. | Lease status is CURRENT STATE; lease workflow events and export events provide append history for selected transitions. |
| Tenant lease notices | `/api/tenant/lease-notices/*` | Tenant lease notice feature and tenant authority | Lists notices, reads detail, records viewed state, and records tenant response. | APPEND-SAFE lease workflow events accompany notice lifecycle transitions. |
| Maintenance workflows | `/api/maintenance-requests/*` and work order routes | Tenant, landlord, contractor, or admin authority depending on route | Creates, reviews, assigns, schedules, confirms, costs, completes, reworks, and uploads evidence. | Mixed CURRENT STATE work order records and APPEND-SAFE status, cost, and update history. |
| Payments and lease ledger | `/api/payments`, lease ledger routes, rent payment services | Authenticated landlord or tenant route authority depending on surface | Lists payments, exports payments, records lease ledger charges/payments, and supports payment checkout lifecycle. | Payment records are CURRENT STATE; ledger and payment events provide continuity for review. |
| Compliance readiness | `/api/compliance/rules`, `/api/landlord/audit-compliance/readiness` | Authenticated account; landlord for readiness | Reads rules and derives audit readiness. | Read-only derivation; evidence links point to timeline and evidence preview surfaces. |
| Support operations | `/api/admin/support-operations/*` | Authenticated admin permission | Reads support and operations profiles. | Read-only review profile; source observability and alert records remain upstream. |
| Support escalations | `/api/admin/support/escalations/*` | Authenticated admin permission | Reads escalation metadata and detail. | Metadata-only review surface; history count and governed workspace linkage are exposed. |
| Support console resource | `/api/admin/support-console/resource` | Authenticated admin permission | Reads a support resource and records access audit. | APPEND-SAFE access audit event is recorded on read. |
| Release governance | `/api/admin/release-governance/*` | Authenticated admin permission | Reads release governance review state. | Review-state continuity depends on existing release governance records and audit artifacts. |

## Backend Service Inventory

| Service area | Representative files | Role in review infrastructure | Continuity classification |
| --- | --- | --- | --- |
| Governed review workspace read model | `rentchain-api/src/services/admin/governedReviewWorkspaceRead.ts` | Reads metadata-only review workspace records, safe evidence refs, append refs, and related workspace links. | APPEND-SAFE metadata read model. |
| Support escalation review | `rentchain-api/src/services/admin/adminSupportEscalationReview.ts` | Derives admin support escalation queue/detail metadata. | CURRENT STATE summary with history metadata. |
| Lease admin review | `rentchain-api/src/services/admin/adminLeaseView.ts` and admin lease lifecycle review services | Derives admin lease review queue, acknowledgement status, related decisions, and recent history. | Mixed CURRENT STATE acknowledgement and history events. |
| Landlord decision state | `rentchain-api/src/services/landlord/landlordDecisionStates.ts` | Stores reviewed, snoozed, dismissed, executed, and failed decision action state. | CURRENT STATE records with deterministic identifiers. |
| Landlord decision history | `rentchain-api/src/services/landlord/landlordDecisionHistory.ts` and appearance event service | Reads and emits canonical decision timeline events. | APPEND-SAFE canonical event usage. |
| Screening history and orchestration | `rentchain-api/src/services/screening/*` | Normalizes screening applications, orders, results, and events; records screening state transitions. | APPEND-SAFE event stream plus CURRENT STATE application/order/result records. |
| Screening operations | `rentchain-api/src/services/screeningOps/*` | Manages manual screening operation requests and admin status transitions. | CURRENT STATE operation status with transition validation. |
| Screening payment transactions | `rentchain-api/src/services/screeningPaymentTransactionService.ts` | Records screening payment initiation, success, and failure. | CURRENT STATE transaction records with status history implied by events. |
| Lease notice workflow | `rentchain-api/src/services/leaseNoticeWorkflowService.ts` | Sends lease notice workflow records and appends workflow events. | APPEND-SAFE workflow events. |
| Lease lifecycle and drafts | `rentchain-api/src/services/leaseLifecycle/*`, `rentchain-api/src/services/leaseDraftsService.ts` | Derives lease lifecycle state and manages draft lifecycle. | Mixed derived lifecycle and CURRENT STATE draft records. |
| Maintenance approval execution | `rentchain-api/src/services/maintenanceApprovalExecutionService.ts` | Applies approved maintenance cost review state and records work order updates. | CURRENT STATE work order updates plus APPEND-SAFE history entries. |
| Payments | `rentchain-api/src/services/paymentsService.ts`, `rentchain-api/src/services/rentPayments/rentPaymentService.ts` | Reads payments, manages checkout lifecycle, and emits payment events. | CURRENT STATE payment records plus APPEND-SAFE payment events. |
| Compliance derivation | `rentchain-api/src/services/compliance/*` | Derives rules and audit readiness. | Read-only derivation from source records. |
| Audit event services | `rentchain-api/src/services/auditEventService.ts`, `rentchain-api/src/services/auditEventsService.ts` | Writes and reads audit events. | APPEND-SAFE event collection usage. |

## Frontend Workspace Inventory

| Surface | Representative files | State model | Continuity notes |
| --- | --- | --- | --- |
| Admin governed review workspaces | `rentchain-frontend/src/pages/admin/AdminReviewWorkspacesPage.tsx`, `rentchain-frontend/src/api/adminReviewWorkspacesApi.ts` | React state for filters, selection, detail, loading, and error. | Metadata-only display; no mutation controls observed. |
| Review workspace panel and queue | `rentchain-frontend/src/components/reviewWorkspaces/*` | Local lifecycle and assignment control state. | CONTINUITY GAP: manual assignment/status selections are UI metadata only and do not persist to a backend writer in the observed components. |
| Decision inbox | `rentchain-frontend/src/pages/DecisionInboxPage.tsx`, `rentchain-frontend/src/api/decisionInboxApi.ts` | React state for queue data, filters, loading, and error. | Links to evidence and timeline surfaces; no unsaved state persistence observed. |
| Review timeline | `rentchain-frontend/src/pages/ReviewTimelinePage.tsx`, `rentchain-frontend/src/api/reviewTimelineApi.ts` | URL query parameters for scope, scope identifier, and filters; React state for loaded data. | URL carries review context for reload continuity. |
| Screening review | `rentchain-frontend/src/pages/AdminScreeningsPage.tsx`, screening components and API helpers | React state for selected operation, result fields, flags, report fields, and action status. | CONTINUITY GAP: in-progress admin screening form entries are local until submit. |
| Verified screenings | `rentchain-frontend/src/pages/AdminVerifiedScreeningsPage.tsx` | React state for queue, selected detail, search, and status update action. | Status updates persist through the API; filters are local. |
| Lease lifecycle review | `rentchain-frontend/src/pages/admin/AdminLeaseLifecycleReviewPage.tsx` | React state for queue, summary, busy item, and decision status. | Decision actions persist through decision API; acknowledgement state persists through lifecycle API. |
| Lease ledger and decisions | `rentchain-frontend/src/pages/LeaseLedgerPage.tsx` | Route parameter for lease, React state for date filters, modal forms, decisions, notes, and ledger data. | CONTINUITY GAP: unsaved charge/payment/note modal state is local only. |
| Active leases and lease summaries | landlord lease pages and lease API helpers | React state for searches, payment rails, document actions, conversion forms, and selected records. | Server state persists only after submit; in-progress forms are local. |
| Tenant lease notices | `rentchain-frontend/src/pages/tenant/TenantLeaseNoticesPage.tsx`, tenant lease notice API helper | React state for notice list/detail and response action. | Notice view and response state persist server-side. |
| Maintenance workspace | `rentchain-frontend/src/pages/MaintenanceRequestsPage.tsx`, `rentchain-frontend/src/pages/MaintenancePage.tsx`, maintenance API helpers | React state for selected request, filters, scheduling forms, cost review fields, status action, and calendar view. | Mixed server continuity for submitted actions and local-only continuity for in-progress forms. |
| Payments | `rentchain-frontend/src/pages/PaymentsPage.tsx`, payments API helper | React state for rows, export state, labels, and import preview. | Export and imported records depend on backend completion; UI table state is local. |
| Audit compliance | `rentchain-frontend/src/pages/AuditCompliancePage.tsx`, audit compliance API helper | React state for readiness data, loading, and error. | Links to evidence and timeline context; read-only derivation. |
| Support operations | `rentchain-frontend/src/pages/SupportOperationsPage.tsx` | URL status filter and React state for profiles. | URL carries status filter continuity. |
| Support escalations | `rentchain-frontend/src/pages/admin/AdminSupportEscalationsPage.tsx` | React state for filters, selected escalation, detail, loading, and error. | Metadata-only review; no approval or note writer observed in page. |

## Evidence And Provenance Sources

| Source | Evidence role | Notes |
| --- | --- | --- |
| Canonical events | Timeline and decision appearance history. | Used by landlord review timeline and decision history derivation. |
| Screening events | Screening lifecycle evidence. | Written during request, run, completion, failure, and report-related transitions. |
| Lease workflow events | Lease notice lifecycle evidence. | Appended when notices are sent, viewed, responded to, and when lease status changes. |
| Work order status and cost history | Maintenance lifecycle evidence. | Used for request status, contractor scheduling, cost review, approval, and completion continuity. |
| Payment and ledger events | Payment lifecycle evidence. | Used to derive payment checkout and lease ledger continuity. |
| Audit events | Admin/support/compliance evidence. | Access and operational audit records provide append-safe review history. |
| Governed review workspace append refs | Admin review workspace provenance. | Metadata-only refs point to append-compatible source activity. |
| Evidence pack previews | Review context envelope. | Read-only derived preview; does not create external share artifacts. |

## Authority Boundary Map

| Actor boundary | Review surfaces | Observed controls |
| --- | --- | --- |
| Tenant | Tenant lease notices, tenant documents, tenant payments, tenant maintenance, tenant messages, tenant notifications, tenant profile | Prior Phase 1 hardening established tenant-safe projections; Phase 2 audit treats tenant surfaces as downstream review inputs only. |
| Landlord | Decision inbox, review timeline, evidence pack preview, lease ledger, maintenance workspace, payment list, audit readiness | Routes generally require authenticated landlord context and scoped ownership checks before review data is returned. |
| Admin/support | Governed review workspaces, support operations, support escalations, screening operations, verified screenings, release governance, admin lease review | Admin routes use authenticated admin permission checks and metadata-only review models for sensitive support/review areas. |
| External/provider boundary | Screening reports, payment checkout lifecycle, exported documents | Provider payloads and external references require continued projection checks before review or export use. |

## Gaps And Concerns

| Label | Area | Observation |
| --- | --- | --- |
| CONTINUITY GAP | Review workspace assignment controls | UI controls expose manual status and assignment metadata, but the observed component state is local and not backed by a writer. |
| CONTINUITY GAP | Screening operation forms | Admin operation detail fields are local until submit; reloads or navigation can lose in-progress review notes, flags, and report fields. |
| CONTINUITY GAP | Lease ledger modal forms | Charge, payment, note, and decision-related modal state is local until saved. |
| CONTINUITY GAP | Maintenance scheduling and cost forms | Scheduling, access, cost, and contractor assignment inputs are local until the relevant action succeeds. |
| CONTINUITY GAP | Mixed decision state model | Derived decisions are read-time outputs while action status is stored separately as mutable current state. |
| PROJECTION CONCERN | Screening report and verified screening surfaces | Report-facing routes and UI require continued verification that provider payloads remain summarized and redacted. |
| PROJECTION CONCERN | Support escalation details | Metadata-only design is present; future writers must preserve the same projection boundary. |
| PROJECTION CONCERN | Payment exports and ledger exports | Export paths require continued verification that raw provider references and internal identifiers remain excluded from user-facing artifacts. |

## Phase 2 Inventory Result

The repository contains a broad review workspace layer spanning admin review workspaces, landlord decision review, screening operations, lease lifecycle review, maintenance review, payments, compliance readiness, support operations, and release governance.

The strongest continuity mechanisms are append-safe event records, canonical timeline derivation, evidence preview envelopes, and lease/maintenance/payment workflow histories. The weakest continuity areas are local-only frontend review forms and split decision state where derived decisions and action records are stored separately.
