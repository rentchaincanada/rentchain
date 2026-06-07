# Tenant Route Audit

Source branch: docs/phase-f-tenant-portal-environment-v1

Audited source files:
- /Users/rentchain/dev/rentchain/rentchain-api/src/app.build.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantParticipationRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantOnboardingHardeningRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantInviteAliasesRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/publicTenantShareRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantFeedbackRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantsRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/adminTenantsRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/App.tsx

## Mount Table

Current tenant-related mounts in /Users/rentchain/dev/rentchain/rentchain-api/src/app.build.ts:

| Mount | Source | Audience | Continuity note |
| --- | --- | --- | --- |
| /api/public | publicTenantShareRoutes.ts | Public token share review | Token-based, not authenticated tenant workspace. |
| /api/public | tenantHistoryShareRoutes.ts public router | Public token history read | Mounted before authenticated routers. |
| /api/tenants | tenantsRoutes.ts | Landlord/admin tenant management | Uses landlord/admin route family, not tenant self-service. |
| /api/tenant-history | tenantHistoryShareRoutes.ts | Landlord/admin sharing plus public history links | Separate from /api/tenant workspace. |
| /api/tenant-invites | tenantInvitesRoutes.ts | Landlord/admin invite operations and authenticated redeem | Rate limited by tenant workspace entry limiter. |
| /api/tenant/invite | tenantPortalRoutes.ts through /api/tenant mount | Authenticated tenant invite redemption | Mounted before alias routes. |
| /api/tenant | tenantPortalRoutes.ts | Authenticated tenant workspace and legacy tenant portal endpoints | Primary tenant self-service router. |
| /api/tenant | tenantParticipationRoutes.ts | Authenticated tenant participation profile | Mounted after tenantPortalRoutes.ts. |
| /api/tenant | tenantOnboardingHardeningRoutes.ts | Authenticated tenant onboarding hardening | Mounted after tenantParticipationRoutes.ts. |
| /api | tenantInviteAliasesRoutes.ts | Public invite lookup and accept aliases | Provides /api/tenant/invites/:token and accept. |
| /api | tenantEventsRoutes.ts | Tenant event feed and landlord event write surfaces | Mounted after tenant portal. |
| /api | tenantEventsWriteRoutes.ts | Landlord tenant-event write/read surfaces | Shares some paths with tenantEventsRoutes.ts. |
| /api | tenantNoticesRoutes.ts | Landlord notice creation | Tenant reads notices through /api/tenant/notices. |
| /api/tenant/lease-notices | tenantLeaseNoticeRoutes.ts | Authenticated tenant lease notice workflow | Mounted after tenant notices. |
| /api | ledgerAttachmentsRoutes.ts | Ledger attachment access | Cross-check tenant ledger attachment scope before edits. |
| /api | maintenanceRequestsRoutes.ts | Landlord/general maintenance requests | Separate from tenantPortalRoutes.ts tenant maintenance endpoints. |
| /api/tenant-report | tenantReportRoutes.ts | Landlord tenant report | Not tenant self-service. |
| /api/tenant-report-pdf | tenantReportPdfRoutes.ts | Landlord report PDF | Not tenant self-service. |
| /api | tenantFeedbackRoutes.ts | Authenticated tenant feedback | Mounted earlier than core tenant block. |

## Primary Tenant Self-Service Routes

All tenantPortalRoutes.ts routes are behind router.use(authenticateJwt). Two tenant guards are used:

- requireTenantWorkspaceIdentity requires req.user.role tenant, req.user.id, and req.user.tenantId, then downstream handlers call resolveTenancyContext.
- requireTenant requires req.user.role tenant and req.user.tenantId and returns { ok: false, error: "UNAUTHORIZED" } on failure.

| Endpoint | Method | Auth | Response shape | Notes |
| --- | --- | --- | --- | --- |
| /api/tenant/workspace | GET | requireTenantWorkspaceIdentity | { ok, data } | Primary workspace load with context, tenant, property, unit, application, lease, maintenance, identity, credibility, portability, and timeline. |
| /api/tenant/me | GET | requireTenantWorkspaceIdentity first; later duplicate requireTenant | { ok, data } first handler | Duplicate route; first registration wins for normal requests. |
| /api/tenant/profile | GET/PATCH | requireTenantWorkspaceIdentity | { ok, data } | Tenant profile projection and scoped profile update. |
| /api/tenant/application-status | GET | requireTenantWorkspaceIdentity | { ok, data } | Current application projection. |
| /api/tenant/application-completion | GET | requireTenantWorkspaceIdentity | { ok, data } | Completion checklist summary. |
| /api/tenant/application-reuse | GET | requireTenantWorkspaceIdentity | { ok, data } | Reusable application projection. |
| /api/tenant/lease | GET | requireTenantWorkspaceIdentity first; later duplicate requireTenant | { ok, data } first handler | Duplicate route; first registration wins. |
| /api/tenant/lease/document-url | GET | requireTenantWorkspaceIdentity | { ok, data } | Tenant-scoped document URL/status response. |
| /api/tenant/leases/:leaseId/payments/checkout | POST | requireTenantWorkspaceIdentity | { ok, data: { rentPaymentId, status, redirectUrl } } | Lease-scoped payment checkout. |
| /api/tenant/leases/:leaseId/payments | GET | requireTenantWorkspaceIdentity | { ok, data } | Lease payment rail and latest payment status. |
| /api/tenant/leases/:leaseId | GET | requireTenantWorkspaceIdentity | { ok, data } | Lease detail projection. |
| /api/tenant/leases/:leaseId/sign | POST | requireTenantWorkspaceIdentity | { ok, data } | Tenant lease signing mutation. |
| /api/tenant/ledger | GET | requireTenant first; later duplicate static fallback | { ok, data } | Duplicate route; service-backed handler precedes static fallback. |
| /api/tenant/attachments | GET | requireTenantWorkspaceIdentity | { ok, data } | Tenant-safe attachment list. |
| /api/tenant/ledger/:ledgerItemId/attachments | GET | requireTenant | { ok, data } | Tenant ledger item attachment list. |
| /api/tenant/communications | GET | requireTenantWorkspaceIdentity | { ok, data } | Tenant communications workspace. |
| /api/tenant/communications/messages | POST | requireTenantWorkspaceIdentity | { ok, data } | Tenant message create. |
| /api/tenant/communications/read | POST | requireTenantWorkspaceIdentity | { ok } | Read-state mutation. |
| /api/tenant/messages | GET | requireTenant | { ok, items, unreadCount } | Legacy message list. |
| /api/tenant/messages/read-all | POST | requireTenant | { ok, updated } | Legacy read-all mutation. |
| /api/tenant/messages/:id/read | POST | requireTenant | { ok } | Message read-state mutation. |
| /api/tenant/messages/maintenance/:requestId/read | POST | requireTenant | { ok } | Maintenance message read-state mutation. |
| /api/tenant/messages/screening/:requestId/read | POST | requireTenant | { ok } | Screening message read-state mutation. |
| /api/tenant/notifications | GET | requireTenantWorkspaceIdentity | { ok, data } | Notification feed. |
| /api/tenant/notifications/:id/read | POST | requireTenantWorkspaceIdentity | { ok } | Notification read-state mutation. |
| /api/tenant/activity | GET | requireTenantWorkspaceIdentity | { ok, data } | Same handler as notifications. |
| /api/tenant/notification-preferences | GET/PATCH | requireTenantWorkspaceIdentity | { ok, data } | Cross-device preference state. |
| /api/tenant/maintenance-requests | GET/POST | requireTenantWorkspaceIdentity first; later duplicate requireTenant | { ok, data } | Duplicate route; workspace handler precedes legacy handler. |
| /api/tenant/maintenance | GET | requireTenant | { ok, data } | Maintenance list alias. |
| /api/tenant/maintenance-requests/:id | GET | requireTenant | { ok, data } | Maintenance detail. |
| /api/tenant/maintenance/:id/reopen | POST | requireTenant | { ok, data } | Tenant reopen mutation. |
| /api/tenant/maintenance/:id/signoff | POST | requireTenant | { ok, data } | Tenant signoff mutation. |
| /api/tenant/maintenance/:id/rework-signoff | POST | requireTenant twice | { ok, data } | Duplicate route appears twice; preserve ordering until a dedicated cleanup mission. |
| /api/tenant/maintenance/:id/confirm-rework-access | POST | requireTenant | { ok, data } | Rework access confirmation. |
| /api/tenant/maintenance-requests/:id/confirmation | POST | requireTenant | { ok, data } | Schedule/access confirmation. |
| /api/tenant/screening | GET | requireTenant | { ok, items } | Screening inbox. |
| /api/tenant/screening/:requestId/status | GET | requireTenant | { ok, screeningRequest } | Screening status. |
| /api/tenant/screening/:requestId/consent | POST | requireTenant | { ok, screeningRequest } | Tenant consent mutation. |
| /api/tenant/screening/:requestId/start | POST | requireTenant | { ok, screeningRequest } | Provider start surface. |
| /api/tenant/screening/:requestId/retry | POST | requireTenant | { ok, screeningRequest } | Retry mutation. |
| /api/tenant/screening/provider/transunion/callback | POST | authenticateJwt only | provider callback response | Not a normal tenant UI route; requires dedicated review before edits. |
| /api/tenant/access | GET | requireTenantWorkspaceIdentity | { ok, data } | Access/share workspace. |
| /api/tenant/access/:shareId/revoke | POST | requireTenantWorkspaceIdentity | { ok, shareId, revoked } | Tenant share revoke. |
| /api/tenant/share-packages | GET/POST | requireTenantWorkspaceIdentity | { ok, data } | Tenant share package list/create. |
| /api/tenant/share-packages/:id | DELETE | requireTenantWorkspaceIdentity | { ok, data } | Revoke/delete package. |
| /api/tenant/share-packages/:id/respond | POST | requireTenantWorkspaceIdentity | { ok, data } | Tenant package response. |
| /api/tenant/share-packages/:id/verification-requests/:requestId/respond | POST | requireTenantWorkspaceIdentity | { ok, data } | Verification response. |
| /api/tenant/share-packages/:id/verification-requests/:requestId/revoke | POST | requireTenantWorkspaceIdentity | { ok, data } | Verification revoke. |
| /api/tenant/trust-exports | GET/POST | requireTenantWorkspaceIdentity | { ok, data } | Export list/create. |
| /api/tenant/trust-exports/preview | POST | requireTenantWorkspaceIdentity | { ok, data } | Preview, expected non-mutating. |
| /api/tenant/trust-exports/:id/revoke | POST | requireTenantWorkspaceIdentity | { ok, data } | Export revoke. |
| /api/tenant/institution-access/grants | GET/POST | requireTenantWorkspaceIdentity | { ok, data } | Institution grant list/create. |
| /api/tenant/institution-access/preview | POST | requireTenantWorkspaceIdentity | { ok, data } | Institution access preview. |
| /api/tenant/institution-access/invites | POST | requireTenantWorkspaceIdentity | { ok, data } | Institution invite. |
| /api/tenant/institution-access/grants/:id/delivery/resend | POST | requireTenantWorkspaceIdentity | { ok, data } | Grant resend. |
| /api/tenant/institution-access/grants/:id/revoke | POST | requireTenantWorkspaceIdentity | { ok, data } | Grant revoke. |
| /api/tenant/identity/export | POST | requireTenantWorkspaceIdentity | { ok, data } | Institutional identity export v1.0 or v2.0. |
| /api/tenant/institutional/handoffs | GET/POST | requireTenantWorkspaceIdentity | { ok, data } | Handoff list/create. |
| /api/tenant/institutional/handoffs/:handoffId | DELETE | requireTenantWorkspaceIdentity | { ok, data } | Soft void handoff. |
| /api/tenant/invite/redeem | POST | requireTenantWorkspaceIdentity | { ok, data } | Authenticated invite redeem. |
| /api/tenant/notices | GET | requireTenant | { ok, data } | Tenant notice list. |
| /api/tenant/notices/:noticeId | GET | requireTenant | { ok, data } | Tenant notice detail. |
| /api/tenant/notices/:noticeId/read | POST | requireTenant | { ok } | Notice read-state mutation. |
| /api/tenant/communication/summary | GET | requireTenant | summary object | Legacy communication summary. |

## Adjacent Tenant Route Families

| Endpoint | Source | Auth | Response shape | Boundary |
| --- | --- | --- | --- | --- |
| /api/tenant/participation-profile | tenantParticipationRoutes.ts | authenticateJwt plus tenant role | { ok, profiles } | Tenant self-service profile list. |
| /api/tenant/participation-profile/:tenantParticipationId | tenantParticipationRoutes.ts | authenticateJwt plus tenant role | { ok, profile } | Profile must belong to derived tenant profile set. |
| /api/tenant/onboarding-hardening | tenantOnboardingHardeningRoutes.ts | authenticateJwt plus tenant role | { ok, profiles } | Tenant self-service hardening profile list. |
| /api/tenant/lease-notices | tenantLeaseNoticeRoutes.ts | authenticateJwt plus tenant role plus feature flag | { ok, items, data } | Tenant notice workflow list. |
| /api/tenant/lease-notices/:id | tenantLeaseNoticeRoutes.ts | authenticateJwt plus tenant role plus lease workflow lookup | { ok, item, data, noResponse } | View may write tenant_viewed_notice delivery state. |
| /api/tenant/lease-notices/:id/respond | tenantLeaseNoticeRoutes.ts | authenticateJwt plus tenant role plus lease workflow lookup | { ok, item, data } | Tenant response mutation. |
| /api/tenant/feedback | tenantFeedbackRoutes.ts | requireAuth plus tenant role | { feedback: { id, createdAt } } | Tenant feedback mutation. |
| /api/tenant/invites/:token | tenantInviteAliasesRoutes.ts | public token lookup | invite response or NOT_FOUND | Public alias; token values must not be copied into logs or docs. |
| /api/tenant/invites/:token/accept | tenantInviteAliasesRoutes.ts | public token accept | acceptance response | Public alias that returns tenant role token on success. |
| /api/public/share/:token | publicTenantShareRoutes.ts | public token lookup | share package response | Public share package review; not tenant workspace auth. |
| /api/public/share/:token/request | publicTenantShareRoutes.ts | public token request | request response | Public package request. |
| /api/public/share/:token/verification-request | publicTenantShareRoutes.ts | public token request | verification request response | Public verification request. |
| /api/public/share/:token/apply | publicTenantShareRoutes.ts | public token request | apply response | Public application via share package. |
| /api/tenants/* | tenantsRoutes.ts | requireLandlord with admin allowance in service branches | landlord/admin response shapes | Tenant management, not tenant self-service. |
| /api/admin/tenants* | adminTenantsRoutes.ts | requireAuth plus admin permissions | admin response shapes | Admin-only tenant inspection. |

## Duplicate And Overlap Findings

- /api/tenant/me appears twice in /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts. The first route uses requireTenantWorkspaceIdentity and handleTenantWorkspaceSummary; the later legacy route uses requireTenant.
- /api/tenant/lease appears twice. The first workspace route uses requireTenantWorkspaceIdentity; the later legacy route uses requireTenant.
- /api/tenant/ledger appears twice. The first service-backed route precedes a static/legacy fallback.
- /api/tenant/maintenance-requests GET and POST appear twice. The first workspace routes precede later legacy routes.
- /api/tenant/maintenance/:id/rework-signoff appears twice with requireTenant and separate handler bodies.
- /api/tenant-events appears in both tenantEventsRoutes.ts and tenantEventsWriteRoutes.ts with different auth middleware and landlord-oriented behavior.
- tenantAuthRoutes.ts, tenantLedgerRoutes.ts, tenantLedger.ts, tenantPayments.ts, tenantBalanceRoutes.ts, adminTenantToolsRoutes.ts, and tenantAiRoutes.ts exist as route modules but were not observed in /Users/rentchain/dev/rentchain/rentchain-api/src/app.build.ts production mount table.

Continuity impact: Phase G/H/I work must not reorder these mounts or combine duplicates without a dedicated regression mission, because current behavior depends on Express first-match ordering.
