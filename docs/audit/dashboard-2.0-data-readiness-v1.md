# Dashboard 2.0 Data Readiness V1

## Scope

This audit verifies whether the data sources required for Dashboard 2.0 exist and are reliable enough before UI implementation begins.

It reviews the intended Dashboard 2.0 hierarchy:

1. Portfolio Status
2. Decision Queue
3. Upcoming Actions
4. Financial Snapshot
5. Portfolio Detail

This is a documentation-only audit. It does not implement code, routes, UI, API changes, backend services, tests, Cloud Run changes, or Vercel changes.

## Executive Summary

Dashboard 2.0 implementation should not start until the held architecture queue is resolved. PR #1185 is now merged and provides the read-only Decision Queue API contract; portfolio and financial readiness still depend on the pending PR #1191 normalization work and any follow-on API exposure decision.

Readiness summary:

| Section | Readiness | Reason |
| --- | --- | --- |
| Portfolio Status | Partial | Landlord-scoped counts exist in `/api/dashboard/summary`, but rent collection and occupancy are split across newer and legacy sources. |
| Decision Queue | Strong | Normalization service and read-only API exposure are merged through PR #1185. |
| Upcoming Actions | Partial | Lease expiry/notice and tenant move-in readiness exist; move-out, inspections, and maintenance scheduling are not yet unified into a dashboard-ready feed. |
| Financial Snapshot | Partial | Lease ledger/payment APIs exist, but portfolio-level collected/outstanding/cash-flow data is split and some dashboard rent fields remain zeroed. |
| Portfolio Detail | Moderate | Properties, tenants, leases, and maintenance sources exist, but some property overview services are legacy/unscoped and should not be reused directly without landlord scoping. |

Recommendation:

1. Treat merged PR #1185 as the Decision Queue API baseline for Dashboard implementation.
2. Use `/api/dashboard/summary` only as a transitional summary source.
3. Use Decision Queue API for decisions, not legacy dashboard action prompts.
4. Add a frontend dashboard adapter that clearly marks unavailable/degraded sections.
5. Use pending PR #1191 as the portfolio/financial normalization baseline once its narrow stabilization fixes land.
6. Defer any new backend aggregation endpoint until implementation proves the existing APIs cannot safely support the view models.

## Confidence Levels

| Confidence | Meaning |
| --- | --- |
| High | Existing source is scoped, tested or recently validated, and maps directly to Dashboard needs. |
| Medium | Existing source exists but needs adaptation, cross-source joining, or careful degraded handling. |
| Low | Existing source is stubbed, legacy, unscoped, incomplete, or not dashboard-ready. |

## 1. Portfolio Status

### Required Signals

- Occupancy.
- Active leases.
- Rent collection.
- Critical issues.

### Source Inventory

| Signal | Source endpoint/service | Confidence | Notes |
| --- | --- | --- | --- |
| Landlord KPI counts | `GET /api/dashboard/summary` in `rentchain-api/src/routes/dashboardRoutes.ts` | Medium | Landlord-scoped and already filters some hidden/demo state. Exposes properties, units, tenants, actions, screenings, applications. |
| Active leases | `leaseRoutes.ts` active/current lease routes and dashboard summary lease query | Medium | Lease sources are landlord-scoped in lease routes. Dashboard summary already queries leases but primarily uses them for notice summary, not full portfolio health. |
| Occupancy | `dashboardRoutes.ts` active tenant/property counts; `portfolioOverviewService.ts`; lease/unit projections | Low to Medium | Dashboard summary exposes active tenant count, not a full occupied/total/vacancy model. `portfolioOverviewService.ts` computes occupancy but currently loads all properties/units without landlord scoping. |
| Rent collection | `dashboardRoutes.ts` rent object; lease ledger/payment routes; `paymentsRoutes.ts`; `ledgerRoutes.ts`; `ledgerV2Routes.ts` | Low to Medium | Dashboard summary currently returns `collectedCents`, `expectedCents`, and `delinquentCents` as zero. Lease/ledger/payment sources exist, but portfolio rollup is not dashboard-ready. |
| Critical issues | Normalized decision queue service/API | High | This is the correct source for critical issue count. Do not derive critical counts from legacy dashboard actions. |

### Data Quality Issues

- `/api/dashboard/summary` rent values are currently zeroed and cannot power Financial Snapshot or rent health without additional aggregation.
- `dashboardOverviewService.ts` appears to use in-memory/local services and is not appropriate as the production landlord-scoped portfolio source.
- `portfolioOverviewService.ts` computes useful occupancy/vacancy/rent fields but reads all properties/units/payments without landlord scoping in the service shown, so it is not safe as-is for Dashboard 2.0.
- Occupancy health may disagree unless it uses the same lease/unit/tenant projections that power `/leases`, `/tenants`, and `/properties`.

### Blockers

- Portfolio Status cannot rely on one clean portfolio health endpoint today.
- Rent collection cannot be considered reliable from current dashboard summary fields.
- Occupancy should not use unscoped portfolio overview code.

### Recommended Fixes

1. Use the merged Decision Queue API for critical count.
2. Use existing landlord-scoped `/api/dashboard/summary` for transitional property/unit/tenant counts.
3. Add a Dashboard frontend adapter that labels rent/occupancy as degraded when the source is incomplete.
4. Later consider a landlord-scoped portfolio summary endpoint if implementation reveals too much cross-source joining in the frontend.
5. Do not use unscoped `portfolioOverviewService.ts` for landlord Dashboard 2.0 until it is scoped and validated.

## 2. Decision Queue

### Required Signals

- Normalized API.
- Severity model.
- Workspace routing.

### Source Inventory

| Signal | Source endpoint/service | Confidence | Notes |
| --- | --- | --- | --- |
| Normalized model | `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueTypes.ts` | High | Includes id, landlordId, sourceType, workspace, severity, recommended action, due dates, status, dedupe/sort, and related refs. |
| Normalization service | `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueService.ts` | High | Normalizes decision inbox, unified inbox, scoped signals, message signals, dedupe, and deterministic sorting. |
| API endpoint | PR #1185 `GET /api/landlord/decision-queue` | High | API is merged and should be treated as the Dashboard decision-source baseline. |
| Severity model | `docs/audit/decision-severity-model-v1.md` | High | Defines critical, warning, needs_review, upcoming, informational. |
| Workspace routing | `docs/audit/decision-routing-model-v1.md` and pending IA docs | High | Defines Dashboard preview, Operations full queue, owning workspace resolution. |
| Messaging source types | Decision queue types/service | High | Includes `message_thread`, `message_unread_priority`, `message_notice_relevance`, `message_maintenance_follow_up`, `message_support_escalation`, `unified_inbox_event`. |

### Data Quality Issues

- The normalization service can accept multiple source signal arrays, but Dashboard 2.0 should not assume every source category has live generators wired into the API yet.
- Unified inbox normalization filters informational items, but message actionability still depends on source records providing meaningful priority/status.
- The API route is merged in #1185; implementation should not duplicate the service contract in frontend code.

### Contract Status

- PR #1185 is now the merged source contract for Dashboard decision-oriented widgets.

### Recommended Fixes

1. Use merged PR #1185 as the source contract.
2. Use the API response directly for Decision Queue Preview.
3. Limit Dashboard preview to critical, warning, blocking needs_review, and near-term upcoming items.
4. Route full queue actions to Operations, not Dashboard.
5. Keep informational and ordinary unread message items out of Dashboard preview.

## 3. Upcoming Actions

### Required Signals

- Lease expiry.
- Move-ins.
- Move-outs.
- Inspections.
- Notices.

### Source Inventory

| Signal | Source endpoint/service | Confidence | Notes |
| --- | --- | --- | --- |
| Lease expiry | `deriveLandlordVisibleExpiringLeases` in `leaseNoticeWorkflowService`; `GET /api/dashboard/summary` leaseNoticeSummary | Medium | Dashboard summary already derives expiring, pending-response, no-response, renewed, quitting counts. |
| Notice timing | `leaseNoticeWorkflowService`, `leaseNoticeLandlordRoutes`, `tenantLeaseNoticeRoutes`, `deriveLeaseLifecycleSummary` | Medium | Notice and response data exists, but Dashboard-ready item-level upcoming actions need queue integration. |
| Move-ins | `tenantMoveInReadinessService.ts`, `GET /api/tenants/:tenantId/move-in-readiness` | Medium | Strong tenant-level readiness exists. Portfolio/dashboard aggregation is not yet a unified source. |
| Move-outs | Lease lifecycle status, notice response, move-out workflow pages | Low to Medium | Signals exist through lease status and notices, but no single Dashboard-ready move-out action feed is confirmed. |
| Inspections | `tenantMoveInReadinessService.ts` item keys `inspection_scheduled` and `inspection_completed` | Low to Medium | Tenant move-in readiness tracks inspection status, but no portfolio upcoming inspection feed is confirmed. |
| Maintenance scheduling | `maintenanceRequestsRoutes.ts` service windows and scheduling status; `maintenanceWorkspaceState.ts` | Medium for maintenance workspace, Low for dashboard rollup | Maintenance records include service windows/statuses. Dashboard-ready upcoming scheduling source is not yet unified. |

### Data Quality Issues

- Lease notice summary is count-based, not a full list of upcoming actions.
- Move-in readiness is tenant-scoped and may need aggregation before Dashboard can show portfolio-wide upcoming actions.
- Inspection and maintenance scheduling are present as workflow details, but not normalized into a single Dashboard upcoming feed.
- Upcoming actions should not be promoted to warnings unless thresholds are crossed.

### Blockers

- Dashboard 2.0 can show a limited Upcoming Actions preview from the merged decision queue, but should not promise full move-in/move-out/inspection coverage until those generators are wired into the queue.

### Recommended Fixes

1. Use Decision Queue `upcoming` items as the first Dashboard upcoming source.
2. Use `leaseNoticeSummary` only as a supporting count until item-level routing is available.
3. Add future queue generators for inspection and move-in/move-out actions if missing after API validation.
4. Keep upcoming actions date-windowed and calm.
5. Label unavailable categories as not yet available rather than silently omitting them.

## 4. Financial Snapshot

### Required Signals

- Collected rent.
- Outstanding rent.
- Cash flow sources.
- Vacancy metrics.

### Source Inventory

| Signal | Source endpoint/service | Confidence | Notes |
| --- | --- | --- | --- |
| Collected rent | Lease ledger routes, `paymentsRoutes.ts`, `ledgerRoutes.ts`, `ledgerV2Routes.ts` | Medium at lease/ledger level | Ledger/payment records exist and are landlord-scoped in key routes. Portfolio aggregation is not cleanly exposed through dashboard summary. |
| Outstanding rent | `derivePaymentReadiness`, ledger/payment routes, tenant balance service | Low to Medium | Payment readiness describes setup/rent-term readiness, not actual outstanding portfolio rent. Tenant balance and ledger can support future rollups. |
| Cash flow sources | `ledgerEvents`, `ledgerEntries`, `rentPayments`, legacy payments | Medium for raw records, Low for dashboard snapshot | Multiple collections/sources are merged in payment routes, but Dashboard needs a stable rollup contract. |
| Vacancy metrics | `portfolioOverviewService.ts`, unit/property/lease projections | Low to Medium | Computation exists, but some services are unscoped or not dashboard-safe. |
| Current dashboard rent fields | `GET /api/dashboard/summary` | Low | Rent fields are currently zeroed. |

### Data Quality Issues

- Payment data has multiple historical/current sources: `ledgerEvents`, `ledgerEntries`, `rentPayments`, and legacy payments.
- `GET /api/dashboard/summary` does not currently provide real rent collection values.
- Payment readiness is useful for setup warnings, not a cash-flow snapshot.
- Vacancy metrics need landlord-scoped, source-coherent unit/lease data.

### Blockers

- Financial Snapshot cannot be fully implemented from current `/api/dashboard/summary` without showing misleading zeros.
- Portfolio-level collected/outstanding rent needs a reliable aggregation source or explicit degraded state.

### Recommended Fixes

1. For first Dashboard 2.0 implementation, show Financial Snapshot only where reliable values exist.
2. Use queue items for overdue/failed/payment readiness warnings.
3. Use Ledger/Payments workspace links for detail.
4. Add a future landlord-scoped financial rollup endpoint if current payment/ledger APIs cannot supply safe portfolio totals.
5. Avoid charts until data quality is verified.

## 5. Portfolio Detail

### Required Signals

- Properties.
- Tenants.
- Leases.

### Source Inventory

| Signal | Source endpoint/service | Confidence | Notes |
| --- | --- | --- | --- |
| Properties | `GET /api/dashboard/summary`; property routes; properties collection | Medium | Dashboard summary counts properties and units; full property details should route to Properties workspace. |
| Tenants | `GET /api/tenants`, `GET /api/tenants/:tenantId`, tenant detail services | Medium to High | Tenant profile and lease state coherence have been recently hardened. Dashboard should use counts/status only. |
| Leases | `leaseRoutes.ts` list/detail/active/summary/document/signing/ledger routes | High for source workspace, Medium for dashboard rollup | Lease workspace is rich and scoped. Dashboard should avoid duplicating lease tables. |
| Maintenance | `GET /maintenance-requests`, `maintenanceWorkspaceState.ts` | Medium | Maintenance records are landlord-scoped and workflow-rich. Dashboard should use counts/top blocker only. |
| Notices | lease notice routes/services | Medium | Strong workflow context exists, but dashboard detail should route to notice/lease workflow. |

### Data Quality Issues

- Portfolio Detail should not use full source tables directly on Dashboard.
- Property overview route/service appears potentially legacy/unscoped; avoid as a direct Dashboard source until reviewed.
- Tenant and lease projections have improved but should still be treated as source-workspace data, not dashboard tables.

### Blockers

- No major blocker for compact Portfolio Detail if it uses safe counts and routes.
- Blocker only appears if implementation tries to render full lists or rely on unscoped property overview data.

### Recommended Fixes

1. Use compact counts and workspace routes only.
2. Do not render full tenant, lease, property, or maintenance tables on Dashboard.
3. Annotate Portfolio Detail rows with queue counts by workspace from the merged Decision Queue API.
4. Route into Properties, Tenants, Leases, Maintenance, Ledger, Messaging, and Trust/Compliance.
5. Keep source workspace detail authoritative.

## Cross-Section Blockers

| Blocker | Affected sections | Severity | Recommended resolution |
| --- | --- | --- | --- |
| Portfolio/financial normalization pending in PR #1191 | Portfolio Status, Financial Snapshot, Portfolio Detail financial/occupancy confidence | High | Land narrow stabilization fixes, then use the normalization service as the backend baseline for any portfolio/financial API exposure. |
| Dashboard summary rent fields are zeroed | Financial Snapshot, Portfolio Status | High | Use degraded state or add/identify reliable financial rollup before showing collected/outstanding totals. |
| Portfolio overview service appears unscoped | Portfolio Status, Financial Snapshot, Portfolio Detail | High | Do not use until landlord scoping is verified/fixed. |
| Upcoming action sources are fragmented | Upcoming Actions | Medium | Start with decision queue upcoming items and add generators later. |
| Maintenance/dashboard rollup is not unified | Upcoming Actions, Portfolio Detail | Medium | Use queue/source counts first; avoid full dashboard maintenance workbench. |

## Recommended Implementation Readiness Decision

Dashboard 2.0 implementation should begin only after:

1. #1185 remains the merged Decision Queue API contract.
2. #1186, #1187, and #1188 are merged as implementation source docs.
3. The first implementation plan accepts degraded states for incomplete financial/portfolio data.
4. The implementation does not attempt to solve financial rollups, maintenance scheduling aggregation, and portfolio overview scoping in the same PR unless separately approved.

## Recommended Fix Sequence Before Or During Implementation

1. Use the merged Decision Queue API.
2. Implement Dashboard data adapter with explicit degraded states.
3. Use Decision Queue API for Decision Queue Preview and critical counts.
4. Use existing dashboard summary for activation/property/unit/tenant counts only.
5. Use safe financial placeholder/degraded state until a reliable landlord-scoped rollup exists.
6. Use upcoming queue items first; defer broad calendar aggregation.
7. Keep Portfolio Detail as workspace route map, not data tables.

## Non-Goals

- No code changes.
- No API changes.
- No UI implementation.
- No Dashboard 2.0 build.
- No Operations build.
- No financial rollup implementation.
- No route changes.
