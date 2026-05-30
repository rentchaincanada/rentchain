# Phase 1 Workspace Projection Safety Audit

Branch: fix/phase-1-tenant-workspace-projection-v1
Mission: Phase 1 Mission 2 - Tenant Workspace Projection Safety Hardening
Scope: Audit and documentation only

## Executive Summary

This audit reviews the tenant workspace projection boundary after the Phase 1 continuity inventory. No runtime code, route handlers, services, tests, configuration, Firestore rules, infrastructure, billing, auth core, screening provider adapters, pricing, or production data are changed by this mission.

The primary tenant workspace route family is mounted at `/api/tenant` through `tenantPortalRoutes.ts` in `app.build.ts`. The route module runs behind `authenticateJwt`, and the main workspace-context paths use `requireTenantWorkspaceIdentity` plus `resolveTenancyContext`. The tenancy resolver is defensive: it derives authority from authenticated tenant identity, tenant records, applications, active leases, active tenancies, or redeemed invites; it rejects unauthenticated, no-authority, and ambiguous multi-property cases.

The strongest projection contract is currently lease-centered. `tenantSafeProjectionContract.ts` defines `tenant_safe_workspace_projection` metadata, allowed field groups, excluded field groups, sensitivity, authority basis, internal reference policy, and redaction policy. `projectTenantLease` attaches that contract and a redaction summary. Property, application, and maintenance projections are explicit whitelists, but only lease projections carry the full contract metadata today.

No evidence of a broad raw document pass-through was found for the primary workspace summary. However, several adjacent workspace surfaces return service-shaped objects outside the explicit tenant-safe contract. Those surfaces should be treated as follow-up hardening candidates, especially identity export/share, application reuse, communications, maintenance actor references, document URL context, and provider callback response shaping.

## Files Audited

- `rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts`
- `rentchain-api/src/services/tenantPortal/tenantProjectionService.ts`
- `rentchain-api/src/services/tenantPortal/tenancyContextService.ts`
- `rentchain-api/src/services/tenantPortal/tenantProfileService.ts`
- `rentchain-api/src/services/tenantPortal/tenantCommunicationsService.ts`
- `rentchain-api/src/services/tenantPortal/tenantNotificationsService.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/services/tenantPortal/tenantTrustExportService.ts`
- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/tenantSignalsRoutes.ts`
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/app/app.ts`
- `rentchain-frontend/src/api/tenantPortal.ts`
- `rentchain-frontend/src/api/tenantPortalApi.ts`
- `rentchain-frontend/src/pages/tenant/TenantDocumentsPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantPaymentsPage.tsx`
- `docs/phase-1/tenant-operational-continuity-map-v1.md`

## Projection Contract Baseline

### Explicit Contract

`tenantSafeProjectionContract.ts` defines the current tenant-safe contract:

- Projection name: `tenant_safe_workspace_projection`
- Version: `tenant_safe_projection_v1`
- Audience: `tenant_workspace`
- Scope type: `tenant_current_lease`
- Sensitivity: `sensitive`
- Authority basis: `authenticated_tenant_scope`
- Internal reference policy: internal identifiers are scoped references for navigation and traceability, not primary display labels.
- Redaction policy: exclude landlord-only notes, raw provider payloads, raw screening reports, raw CSV values, payment account details, debug payloads, route-source metadata, stack traces, private message bodies, and unrelated tenant data.

Allowed field groups:

- `tenant_visible_lease_summary`
- `tenant_visible_document_status`
- `tenant_signature_status`
- `payment_readiness_summary`
- `scoped_source_references`
- `operational_labels`

Excluded field groups:

- `landlord_only_notes`
- `other_tenant_records`
- `raw_provider_payloads`
- `raw_screening_reports`
- `raw_csv_values`
- `payment_account_details`
- `debug_payloads`
- `route_source_metadata`
- `stack_traces`
- `private_message_bodies`

### Projection Function Status

| Function | Current behavior | Audit status |
| --- | --- | --- |
| `projectTenantProperty` | Explicit whitelist for address and feature fields. Includes `propertyId` and `rc_prop_id` as references. | Acceptable with note: contract metadata not attached. |
| `projectTenantLease` | Explicit whitelist, redacts Schedule A document URL from the base lease projection, attaches projection profile, version, sensitivity class, source collections, source refs, and redaction summary. | Compliant baseline. |
| `projectTenantApplication` | Explicit whitelist for application status, missing steps, next actions, and timestamps. | Acceptable with note: contract metadata not attached. |
| `projectTenantMaintenance` | Explicit whitelist for lifecycle fields and filters evidence to `visibility === "tenant_safe"`. | Requires follow-up: `reopenedByActorId` exposes a raw actor reference, and maintenance output does not attach contract metadata or redaction summary. |

## Tenancy Authority Boundary

`resolveTenancyContext` is the main authority resolver for workspace-context paths. It derives candidate authority from:

- Tenant record linkage by tenant identifier or email.
- Application linkage by applicant email, user identifier, tenant identifier, or converted tenant identifier.
- Active lease linkage by tenant identifier, tenant identifier array, email, or direct lease identifier.
- Active tenancy records.
- Redeemed or invited tenancy invite records.

The resolver fails closed when:

- The request has no authenticated user identifier.
- No authority candidate exists.
- Candidate records span more than one property.

The resolver does not trust client path parameters as the authority root for workspace summary, profile, communication, share, export, lease, document URL, payment, or maintenance workspace paths. This is a positive boundary for projection safety.

## Mounted Route Boundary

`app.build.ts` mounts tenant routes in this relevant order:

1. `/api/tenants` -> `tenantsRoutes.ts`
2. `/api` -> `tenantSignalsRoutes.ts`
3. `/api/tenant-invites` -> invite routes with workspace-entry rate limit
4. `/api/tenant` -> `tenantPortalRoutes.ts` with route source
5. `/api/tenant` -> `tenantParticipationRoutes.ts`
6. `/api/tenant` -> `tenantOnboardingHardeningRoutes.ts`
7. `/api/tenant/lease-notices` -> `tenantLeaseNoticeRoutes.ts`

The production build does not mount these route modules directly:

- `tenantAuthRoutes.ts`
- `tenantLedgerRoutes.ts`
- `tenantLedger.ts`
- `tenantPayments.ts`
- `tenantBalanceRoutes.ts`
- `adminTenantToolsRoutes.ts`
- `tenantAiRoutes.ts`

`tenantAiRoutes.ts` is mounted only in the narrower `src/app/app.ts` entry at `/api/tenants`, not in the production `app.build.ts` mount table audited here.

## Workspace Route Compliance

### Primary Workspace Summary

Endpoints:

- `GET /api/tenant/workspace`
- `GET /api/tenant/me` first registration

Behavior:

- Uses `requireTenantWorkspaceIdentity`.
- Resolves context through `resolveTenancyContext`.
- Loads workspace data through `loadTenantWorkspaceData`.
- Projects property, application, lease, and maintenance through `tenantProjectionService`.
- Builds display labels through `buildTenantWorkspaceDisplayProjection`, which avoids using raw IDs as primary display strings when alternate labels exist.
- Records an append-style tenant event for workspace viewing.

Audit status: mostly compliant, with follow-up items.

Notes:

- The response includes `context` with scoped references such as property, application, lease, tenant, and unit identifiers. This matches the current internal reference policy only if clients treat them as traceability references and not visible display labels.
- The response also includes `tenantIdentityRecord`, `tenantCredibilitySignals`, `portableIdentity`, and `identityTimeline`. These are derived service outputs outside `tenantProjectionService` and should receive explicit tenant-safe contract coverage before Phase 1 is closed.
- The display projection includes `tenant.id` and `tenant.shortId`. This should be reviewed if tenant workspace UI exposes those values as labels.

### Profile and Application Reuse

Endpoints:

- `GET /api/tenant/profile`
- `PATCH /api/tenant/profile`
- `GET /api/tenant/application-reuse`
- `GET /api/tenant/application-completion`

Behavior:

- Uses workspace identity and resolved context.
- Profile uses projected property, application, lease, unit, identity status, document checklist, and next steps.
- Application reuse intentionally returns applicant, address, rent, employment, work reference, and next-of-kin fields for tenant reuse.

Audit status: requires follow-up.

Reasoning:

- Profile is largely projection-safe but includes context references and lease document context. It should attach or reference the tenant-safe profile contract explicitly.
- Application reuse returns personal application data by design. It is tenant-owned, but the field list should be contract-documented because it can include employment, reference, and next-of-kin details.

### Lease and Document URL

Endpoints:

- `GET /api/tenant/lease`
- `GET /api/tenant/lease/document-url`
- `POST /api/tenant/leases/:leaseId/sign`

Behavior:

- Uses workspace identity and resolved context.
- Lease projection carries the explicit tenant-safe projection profile and redaction summary.
- Document URL route additionally requires active tenant authority and checks lease ownership with tenant identity before returning a document URL response.

Audit status: compliant baseline with document URL review note.

Notes:

- Base lease projection redacts Schedule A URLs unless requested through the dedicated document URL path.
- The document URL route returns `documentUrl`, display label, document status, source, and expiry. This is intended behavior, but document source labels should remain non-sensitive and should not reveal storage paths.

### Maintenance

Endpoints:

- `GET /api/tenant/maintenance-requests` first registration
- `POST /api/tenant/maintenance-requests` first registration
- Legacy aliases and detail paths under `/api/tenant/maintenance*`

Behavior:

- Workspace list and create paths use workspace identity.
- Projection filters evidence to `tenant_safe` visibility.
- Legacy detail and mutation paths use `requireTenant`.

Audit status: requires follow-up.

Findings:

- `projectTenantMaintenance` exposes `reopenedByActorId`; this is a raw internal actor reference and should be replaced with role-only or display-safe metadata unless a future contract explicitly allows it as a scoped source reference.
- `statusHistory.message`, `reworkHistory.notes`, `tenantAccessNote`, completion summaries, and decline/follow-up reasons are whitelisted text fields. They are tenant-relevant, but should receive a documented redaction rule for landlord-only/internal notes.
- Maintenance projection lacks the explicit projection profile and redaction summary used by lease projection.

### Communications

Endpoints:

- `GET /api/tenant/communications`
- `POST /api/tenant/communications/messages`
- `POST /api/tenant/communications/read`
- Legacy `/api/tenant/messages*` paths

Behavior:

- Workspace communications use resolved context and property-linked landlord context.
- Message send requires applicant or active tenant authority and body length constraints.
- Read state mutation is tenant-context scoped.

Audit status: requires follow-up.

Reasoning:

- Communications intentionally include message bodies. The current tenant-safe contract excludes private message bodies as a general field group, so communications need their own audience-specific contract or a documented exception that distinguishes tenant-visible conversation bodies from private/internal message bodies.
- Thread output includes `propertyId` and `unitId`; these should be traceability references only.

### Notifications and Activity

Endpoints:

- `GET /api/tenant/notifications`
- `GET /api/tenant/activity`

Behavior:

- Uses workspace identity and resolved context.
- Produces derived notification items with title, summary, created timestamp, status, and related path.

Audit status: acceptable with note.

Notes:

- Notification item identifiers include source document references, such as application, lease, maintenance, invite, or message identifiers. These are acceptable only as internal item keys and should not be rendered as display labels.

### Access, Share Packages, Trust Exports, and Institution Access

Endpoints:

- `/api/tenant/access*`
- `/api/tenant/share-packages*`
- `/api/tenant/trust-exports*`
- `/api/tenant/institution-access*`
- `/api/tenant/institutional/handoffs*`
- `/api/tenant/identity/export`

Behavior:

- Uses workspace identity and resolved context.
- Mutating paths are tenant-scoped and generally append or lifecycle-state based.
- Export and share services construct package-specific response shapes.

Audit status: requires follow-up.

Reasoning:

- These surfaces intentionally cross from workspace display into portable review/export flows. They should have explicit contract documents per audience: tenant owner view, external recipient view, institution preview, and revoked/expired lifecycle view.
- The schema version switch in `POST /identity/export` means consumers must not assume a single response shape.
- Token values and delivery details must remain out of logs, audit docs, and visible labels.

### Payment Continuity

Endpoints:

- `POST /api/tenant/leases/:leaseId/payments/checkout`
- `GET /api/tenant/leases/:leaseId/payments`
- Legacy `/api/tenant/payments`
- Legacy frontend calls to `/tenant/payments/summary`, `/tenant/rent-charges`, and confirmation paths

Behavior:

- Lease payment checkout and summary use workspace context and active tenant checks.
- Legacy static `/payments` exists under `tenantPortalRoutes.ts`.
- Frontend legacy payment page still calls endpoints that are not present in the audited production mount table.

Audit status: mixed.

Findings:

- Workspace lease payment paths are scoped by active tenant context and lease linkage.
- Legacy payment summary and rent charge frontend calls are drift risks because the matching backend paths were not found in the mounted production tenant router.
- Payment output must continue to exclude payment account details, stored payment method details, and processor payloads.

### Screening Provider Callback

Endpoint:

- `POST /api/tenant/screening/provider/transunion/callback`

Behavior:

- Sits inside `tenantPortalRoutes.ts` after `authenticateJwt`.
- Does not use `requireTenant` or `requireTenantWorkspaceIdentity`.
- Requires authenticated role `admin` inside the handler.
- Mutates screening redirect state, session, request, result, and audit events.
- Returns `shapeTenantScreeningResponse` for duplicate and successful callback paths.

Audit status: separate governance review required before any code change.

Reasoning:

- This is not a normal tenant workspace endpoint.
- It is mounted under `/api/tenant` but uses admin-only role logic.
- It writes provider callback lifecycle state and screening result metadata.
- Any change here would touch screening provider callback behavior, which is outside this documentation-only mission.

## Duplicate Route Registration Risks

The tenant portal router contains several duplicate path registrations. Express resolves the first matching route first, so ordering is currently part of behavior.

| Path | First registration | Later registration | Risk |
| --- | --- | --- | --- |
| `GET /me` | Workspace summary with `requireTenantWorkspaceIdentity` | Legacy tenant profile with `requireTenant` | Medium: response shape depends on first registration. |
| `GET /lease` | Workspace lease projection with `requireTenantWorkspaceIdentity` | Legacy lease response with `requireTenant` | Medium: first route is tenant-safe, later route may be stale. |
| `GET /ledger` | Service-backed ledger with `requireTenant` | Static fallback with `requireTenant` | Medium: fallback is effectively shadowed. |
| `GET /maintenance-requests` | Workspace maintenance list | Legacy maintenance list | Medium: first route controls normal behavior. |
| `POST /maintenance-requests` | Workspace maintenance create | Legacy maintenance create | Medium: first route controls normal behavior. |
| `POST /maintenance/:id/rework-signoff` | First legacy handler | Second legacy handler | High: duplicate mutation path should be consolidated in a future mission. |

No route order was changed in this mission.

## Unmounted and Legacy Surface Review

The following route modules are present but not mounted in `app.build.ts`:

- `tenantAuthRoutes.ts`
- `tenantLedgerRoutes.ts`
- `tenantLedger.ts`
- `tenantPayments.ts`
- `tenantBalanceRoutes.ts`
- `adminTenantToolsRoutes.ts`
- `tenantAiRoutes.ts`

Frontend references still exist for some legacy or drift-prone APIs:

- `TenantDocumentsPage.tsx` calls `getTenantDocuments`, which calls `/tenant/documents`.
- `TenantPaymentsPage.tsx` calls `/tenant/payments`, `/tenant/payments/summary`, `/tenant/rent-charges`, and `/tenant/rent-charges/:id/confirm`.
- `TenantLedgerPage.tsx` and `tenantLedgerApi.ts` reference `/tenantLedger/:tenantId`, a route family not mounted in `app.build.ts`.

These are continuity and route ownership risks, not projection proof of leakage by themselves. Future work should either wire them through tenant workspace projections or retire the stale client calls.

## Tenant Signals Boundary

`tenantSignalsRoutes.ts` is mounted under `/api` and uses `authenticateJwt`. It reads `/api/tenants/:tenantId/signals`, derives landlord identifier from the authenticated user, and computes tenant signals from ledger events.

Audit status: outside tenant workspace projection boundary, requires future verification.

Reasoning:

- It is not a tenant workspace route and does not use `resolveTenancyContext`.
- Its path includes a tenant identifier parameter.
- It appears landlord-oriented because it derives landlord context from the authenticated user.
- Future changes should verify role and ownership checks explicitly before treating this as tenant-facing or tenant-safe.

## Compliance Matrix

| Area | Status | Summary |
| --- | --- | --- |
| Tenancy context authority | Pass | Server-side resolver fails closed and rejects ambiguous multi-property context. |
| Lease projection | Pass | Full tenant-safe projection metadata and redaction summary attached. |
| Property projection | Pass with note | Explicit whitelist; no contract metadata. |
| Application projection | Pass with note | Explicit whitelist; no contract metadata. |
| Maintenance projection | Needs hardening | Tenant-safe evidence filter exists, but raw actor reference and text-note redaction policy need tightening. |
| Workspace summary | Needs hardening | Core projected fields are safe; derived identity objects need explicit contract coverage. |
| Profile | Needs hardening | Mostly projected, but should carry explicit profile projection contract. |
| Application reuse | Needs hardening | Tenant-owned personal data requires an explicit reuse projection contract. |
| Communications | Needs hardening | Tenant-visible message bodies require a dedicated communications contract. |
| Notifications | Pass with note | Derived feed shape; identifiers must remain internal keys. |
| Document URL | Pass with note | Active tenant plus lease ownership checks; source labels and URLs need continued storage-path review. |
| Payment workspace | Pass with note | Lease-scoped active tenant checks; legacy payment endpoints remain drift risks. |
| Share/export/institution flows | Needs hardening | Tenant-scoped, but portable audience-specific contracts should be documented. |
| Screening callback | Separate review | Admin-only callback under tenant router; provider callback behavior is out of scope. |
| Duplicate route registrations | Needs hardening | Ordering dependencies should be consolidated later. |
| Unmounted legacy modules | Needs hardening | Some frontend calls still target stale or unmounted route families. |

## Recommended Follow-Up Missions

1. Add tenant-safe projection metadata to application, property, maintenance, profile, and communications response shapes.
2. Remove or replace `reopenedByActorId` from tenant maintenance output; keep role-only or display-safe actor metadata.
3. Define a dedicated tenant communications contract that allows tenant-visible conversation bodies while excluding private/internal message bodies.
4. Define audience-specific contracts for identity export, trust export, share package, institution access, and public recipient views.
5. Consolidate duplicate tenant portal route registrations, starting with `/maintenance/:id/rework-signoff`, `/me`, `/lease`, `/ledger`, and `/maintenance-requests`.
6. Resolve legacy frontend drift for `/tenant/documents`, `/tenant/payments/summary`, `/tenant/rent-charges`, and `/tenantLedger/:tenantId`.
7. Review `tenantSignalsRoutes.ts` as a separate landlord/tenant boundary mission before any tenant-facing reuse.
8. Review the TransUnion callback endpoint separately before changing any screening provider callback behavior.

## Known Limitations

- This mission is audit-only and does not change runtime behavior.
- This document does not prove every downstream service field is projection-safe; it identifies where explicit contracts are present and where follow-up field-level review is needed.
- Provider callback behavior is documented but not modified because screening provider adapter and callback changes are outside the authorized scope.
- Duplicate routes and stale frontend calls are documented but not retired in this mission.

## Acceptance Criteria Check

- Tenant workspace projection contract audited.
- Workspace-context route boundary audited.
- Mount order and unmounted legacy modules audited.
- Provider callback endpoint documented as separate-review territory.
- Tenancy context authority boundary audited.
- No source routes, services, auth rules, tests, deployment settings, billing, pricing, Firestore rules, Terraform, or production data changed.
