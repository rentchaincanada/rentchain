# Work Orders Operational Label Normalization v1

## Executive summary

This report documents RentChain's work-order and maintenance terminology normalization pass. The implementation is display and metadata focused:

- tenant-facing surfaces use `Maintenance request`,
- landlord/operator surfaces use `Work order`,
- review/routing metadata uses `Operational work order`,
- vendor/contractor language remains `Service task` where a vendor-specific label is needed,
- machine-style status keys are normalized before primary display.

No Firestore schema, auth, Firestore rules, permissions, route visibility, financial records, or workflow mutation behavior changed.

## Canonical terminology

| Audience | Canonical term | Notes |
| --- | --- | --- |
| Tenant | Maintenance request | Tenant-facing request intake and status language. |
| Landlord/operator | Work order | Operator-facing coordination, cost, assignment, and closure language. |
| Review/routing | Operational work order | Governance-safe review queue and routing metadata language. |
| Vendor/contractor | Service task | Use only where a contractor-facing label is needed. |

Avoid using `repair`, `issue`, `task`, or raw datastore identifiers as primary labels. These may remain as user-entered descriptions, expense categories, or internal resource metadata where already scoped.

## Status mapping

| Internal/source status | Tenant label | Operator/review label |
| --- | --- | --- |
| `submitted` | Submitted | Needs review |
| `reviewed` | Acknowledged | Open |
| `assigned` | Assigned | Assigned |
| `scheduled` | Scheduled | Assigned |
| `in_progress` | In progress | In progress |
| `waiting_on_tenant`, `tenant_pending_signoff` | Waiting on tenant | Waiting on tenant |
| `waiting_on_vendor`, `contractor_pending` | Waiting on vendor | Waiting on vendor |
| `completed`, `resolved` | Completed | Completed |
| `closed` | Closed | Closed |
| `cancelled`, `canceled` | Cancelled | Cancelled |
| `blocked` | Needs review | Needs review |

The mapping is intentionally display-only. Internal statuses are preserved for workflow logic and route behavior.

## Surfaces audited

Backend:

- `rentchain-api/src/routes/workOrdersRoutes.ts`
- `rentchain-api/src/routes/maintenanceRequestsRoutes.ts`
- `rentchain-api/src/lib/operationalReviewRouting/deriveOperationalReviewRouting.ts`
- work-order, maintenance, marketplace, analytics, and review-routing tests.

Frontend:

- `rentchain-frontend/src/pages/landlord/WorkOrdersPage.tsx`
- `rentchain-frontend/src/pages/MaintenanceRequestsPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantMaintenanceRequestsPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantMaintenanceRequestDetailPage.tsx`
- work-order, maintenance workspace, tenant maintenance, and operational label tests.

## Labels normalized

Implemented:

- Added shared frontend label helper for canonical work-order terminology and status/category/priority formatting.
- Normalized landlord work-order table, mobile cards, print summaries, and selected details so primary status/category/priority labels do not display raw keys such as `in_progress`.
- Normalized landlord maintenance workspace primary status/category/priority labels.
- Normalized tenant maintenance request list and detail metadata while preserving tenant-facing `Maintenance request` language.
- Normalized operational review routing metadata for maintenance decisions to `Operational work order review`.
- Normalized maintenance decision related refs from `maintenance_request`/`document` drift to a `work_order` metadata ref with `Operational work order` fallback label.

## Tenant vs operator language boundaries

Tenant-visible surfaces should not expose internal review terms such as `Operational work order review`, `review workspace`, or internal routing metadata. Tenants see maintenance request lifecycle language.

Landlord/operator surfaces can use work-order language for assignment, completion, costs, evidence, and closure.

Review/routing metadata can use operational work-order language but remains manual-only and internal to landlord/admin operational coordination.

## Remaining inconsistencies and safe deferrals

- Some analytics and pricing copy still use broader `maintenance` language. This is acceptable because those are product/domain summaries, not primary work-order labels.
- Expense categories may still include `Repairs`. This is financial categorization language and was left unchanged to avoid accounting/reporting drift.
- Contractor route paths and API concepts still use `jobs`. This is route/API compatibility language and was left unchanged.
- Email subjects and backend event messages include both maintenance request and work-order language depending on audience. These should be reviewed in a later notification-copy mission if needed.

## Future read-model and routing considerations

Future operational read models should carry both:

- canonical internal type/status fields for logic, and
- audience-specific display labels for tenant, operator, review, and vendor surfaces.

Review queue and evidence linkage surfaces should prefer:

- `Operational work order review`,
- human labels such as property/unit/title,
- scoped internal refs only as metadata,
- no autonomous routing or auto-resolution language.

## Runtime behavior confirmation

This mission does not change work-order persistence, maintenance request persistence, Firestore schema, Firestore rules, auth, permissions, route visibility, financial mutation behavior, contractor assignment behavior, or autonomous routing behavior. The code changes are display-label and metadata-label normalization only.
