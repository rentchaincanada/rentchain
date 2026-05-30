# Phase 1 Tenant Operational Continuity Inventory Map

## Executive Summary

This inventory documents the tenant-facing operational surfaces that exist in the repository at the start of Phase 1. It is documentation-only and establishes the continuity map for the remaining Phase 1 tenant continuity missions. No runtime behavior, route logic, projections, tests, configuration, dependencies, or deployment settings are changed by this mission.

Phase 1 continuity scope is the tenant journey from authenticated entry through workspace resolution, application status, lease visibility, document access, ledger/payment continuity, communications, maintenance, screening, notices, share packages, participation records, account settings, and public share review. The governing boundary is server-side authority resolution: tenant access must derive from authenticated tenant identity, applicant linkage, active lease or tenancy linkage, or a valid invite linkage. Landlord and admin surfaces remain separate, server-gated operational views.

## Files Audited

- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/app/app.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/tenantsRoutes.ts`
- `rentchain-api/src/routes/publicTenantShareRoutes.ts`
- `rentchain-api/src/routes/publicRoutes.ts`
- `rentchain-api/src/routes/tenantHistoryShareRoutes.ts`
- `rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts`
- `rentchain-api/src/routes/tenantParticipationRoutes.ts`
- `rentchain-api/src/routes/tenantOnboardingHardeningRoutes.ts`
- `rentchain-api/src/routes/tenantInvitesRoutes.ts`
- `rentchain-api/src/routes/tenantInviteAliasesRoutes.ts`
- `rentchain-api/src/routes/tenantEventsRoutes.ts`
- `rentchain-api/src/routes/tenantEventsWriteRoutes.ts`
- `rentchain-api/src/routes/tenantNoticesRoutes.ts`
- `rentchain-api/src/routes/tenantFeedbackRoutes.ts`
- `rentchain-api/src/routes/tenantReportRoutes.ts`
- `rentchain-api/src/routes/tenantReportPdfRoutes.ts`
- `rentchain-api/src/routes/tenantSignalsRoutes.ts`
- `rentchain-api/src/routes/tenantBalanceRoutes.ts`
- `rentchain-api/src/routes/tenantDetailsRoutes.ts`
- `rentchain-api/src/routes/tenantOnboardRoutes.ts`
- `rentchain-api/src/routes/tenantAuthRoutes.ts`
- `rentchain-api/src/routes/tenantAiRoutes.ts`
- `rentchain-api/src/routes/adminTenantsRoutes.ts`
- `rentchain-api/src/routes/adminTenantToolsRoutes.ts`
- `rentchain-api/src/services/tenantPortal/tenancyContextService.ts`
- `rentchain-api/src/services/tenantPortal/tenantProjectionService.ts`
- `rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts`
- `rentchain-api/src/services/tenantPortal/tenantEventLogService.ts`
- `rentchain-api/src/services/tenantPortal/tenantProfileService.ts`
- `rentchain-api/src/services/tenantPortal/tenantCommunicationsService.ts`
- `rentchain-api/src/services/tenantPortal/tenantNotificationsService.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/services/tenantPortal/tenantTrustExportService.ts`
- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/services/tenantDetailsService.ts`
- `rentchain-api/src/services/tenantLedgerService.ts`
- `rentchain-api/src/services/tenantReportService.ts`
- `rentchain-api/src/services/admin/adminTenantView.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/pages/tenant/`
- `rentchain-frontend/src/api/tenant*.ts`
- `rentchain-frontend/src/api/publicTenantSharePackageApi.ts`
- `.codex/docs/auth.md`
- `.codex/docs/database.md`

## Mount Map

| Mount | Route source | Runtime status | Audience |
| --- | --- | --- | --- |
| `/api/tenant` | `tenantPortalRoutes.ts` | Mounted in `app.build.ts` with `routeSource("tenantPortalRoutes.ts")` after `/api/tenant-invites` rate limit setup | Authenticated tenant workspace and legacy tenant portal endpoints |
| `/api/tenant` | `tenantParticipationRoutes.ts` | Mounted after tenant portal router | Authenticated tenant participation profile |
| `/api/tenant` | `tenantOnboardingHardeningRoutes.ts` | Mounted after participation routes | Authenticated tenant onboarding hardening profile |
| `/api/tenant/lease-notices` | `tenantLeaseNoticeRoutes.ts` | Mounted with route source | Authenticated tenant lease notice workflow |
| `/api/tenants` | `tenantsRoutes.ts` | Mounted before broad `/api` routers | Landlord/admin tenant management and detail views |
| `/api/tenant-invites` | `tenantInvitesRoutes.ts` | Mounted with workspace-entry rate limit | Landlord/admin invite creation/listing and authenticated invite redemption |
| `/api` | `tenantInviteAliasesRoutes.ts` | Mounted with route source | Public invite lookup and acceptance aliases under `/api/tenant/invites/:token` |
| `/api` | `tenantEventsRoutes.ts` | Mounted with route source | Landlord write, tenant event feed, landlord signals |
| `/api` | `tenantEventsWriteRoutes.ts` | Mounted with route source | Landlord event write/read and summary operations |
| `/api` | `tenantNoticesRoutes.ts` | Mounted with route source | Landlord notice creation |
| `/api` | `tenantFeedbackRoutes.ts` | Mounted with route source at `/api` | Authenticated tenant feedback submission |
| `/api/tenant-history` | `tenantHistoryShareRoutes.ts` | Mounted before tenant portal | Authenticated landlord/admin history sharing and public token-based history read |
| `/api/public` | `publicTenantShareRoutes.ts` | Mounted with route source | Token-based public share package review |
| `/api` and `/api/public` | `publicRoutes.ts` | Mounted with route source | Public tenant magic-link entry and other public helpers |
| `/api/tenant-report` | `tenantReportRoutes.ts` | Mounted with route source | Landlord tenant report |
| `/api/tenant-report-pdf` | `tenantReportPdfRoutes.ts` | Mounted with route source | Landlord tenant report PDF |
| `/api` | `tenantSignalsRoutes.ts` | Mounted with route source | Tenant signal read by tenant identifier |
| `/api` | `tenantOnboardRoutes.ts` | Mounted late in core API block | Tenant onboarding create/update |
| `/api/tenants` | `tenantDetailsRoutes.ts` and `tenantOnboardRoutes.ts` | Mounted only in `src/app/app.ts`, the narrower app entry | Legacy/simple app tenant detail and onboarding routes |
| not mounted in `app.build.ts` | `tenantAuthRoutes.ts`, `tenantLedgerRoutes.ts`, `tenantLedger.ts`, `tenantPayments.ts`, `tenantBalanceRoutes.ts`, `adminTenantToolsRoutes.ts`, `tenantAiRoutes.ts` | Present as route modules but not observed in the production `app.build.ts` mount table | Legacy or auxiliary surfaces requiring separate review before reuse |

## Backend Route Inventory

### Authenticated Tenant Workspace Router: `/api/tenant`

All mounted `tenantPortalRoutes.ts` endpoints run after `router.use(authenticateJwt)`. Two tenant guards are present:

- `requireTenantWorkspaceIdentity` resolves workspace context through `resolveTenancyContext`; it accepts tenant authority from applicant, active tenant, or invite linkage and rejects unauthenticated, no-authority, or ambiguous-authority contexts.
- `requireTenant` requires `req.user.role === "tenant"` and a non-empty tenant identifier on `req.user.tenantId`.

| Endpoint | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- |
| `GET /api/tenant/workspace` | `requireTenantWorkspaceIdentity` | `{ ok, data: { context, tenant, landlord, property, unit, application, lease, maintenance, tenantIdentityRecord, tenantCredibilitySignals, portableIdentity, identityTimeline } }` | Primary workspace source. Continuity depends on deterministic tenancy context and display projection resolution. |
| `GET /api/tenant/me` | `requireTenantWorkspaceIdentity` before duplicate legacy route; later `requireTenant` legacy route also exists | Workspace summary shape for first mount, legacy profile shape for later duplicate | Duplicate route registration creates an ordering dependency; the first workspace route handles normal requests. |
| `POST /api/tenant/identity/export` | `requireTenantWorkspaceIdentity` | `{ ok, data }` where `data` is institutional identity schema version `1.0` or `2.0` | Export shape depends on requested `schemaVersion`; future consumers must not assume a single version. |
| `GET /api/tenant/trust-exports` | `requireTenantWorkspaceIdentity` | `{ ok, data: { items } }` | Tenant-owned export list; revoke/write endpoints append export lifecycle state. |
| `POST /api/tenant/trust-exports/preview` | `requireTenantWorkspaceIdentity` | `{ ok, data }` preview | Preview must remain non-mutating. |
| `POST /api/tenant/trust-exports` | `requireTenantWorkspaceIdentity` | `{ ok, data }` prepared export | Continuity depends on consent and export invalidation state. |
| `POST /api/tenant/trust-exports/:id/revoke` | `requireTenantWorkspaceIdentity` | `{ ok, data }` revoked export | Revoke is tenant-scoped by tenant identifier and export identifier. |
| `GET /api/tenant/institution-access/grants` | `requireTenantWorkspaceIdentity` | `{ ok, data: { items } }` | Tenant list of institution grants. |
| `POST /api/tenant/institution-access/preview` | `requireTenantWorkspaceIdentity` | `{ ok, data }` preview | Preview should remain non-mutating. |
| `POST /api/tenant/institution-access/grants` | `requireTenantWorkspaceIdentity` | `{ ok, data }` grant | Creates tenant-controlled institution access. |
| `POST /api/tenant/institution-access/invites` | `requireTenantWorkspaceIdentity` | `{ ok, data }` grant/invite | Delivery state must remain tied to tenant-controlled grant. |
| `POST /api/tenant/institution-access/grants/:id/delivery/resend` | `requireTenantWorkspaceIdentity` | `{ ok, data }` grant | Resend requires tenant-owned grant. |
| `POST /api/tenant/institution-access/grants/:id/revoke` | `requireTenantWorkspaceIdentity` | `{ ok, data }` grant | Revoke must preserve append-safe lifecycle record. |
| `POST /api/tenant/institutional/handoffs` | `requireTenantWorkspaceIdentity` | `{ ok, data }` handoff draft | Handoff uses tenant context and safe context metadata. |
| `GET /api/tenant/institutional/handoffs` | `requireTenantWorkspaceIdentity` | `{ ok, data: { items } }` | Tenant list of handoffs. |
| `DELETE /api/tenant/institutional/handoffs/:handoffId` | `requireTenantWorkspaceIdentity` | `{ ok, data }` voided handoff | Soft-void behavior; should not hard-delete operational history. |
| `POST /api/tenant/share-packages` | `requireTenantWorkspaceIdentity` | `{ ok, data }` created share package | Creates token-backed share package; token value must not be documented or logged. |
| `GET /api/tenant/share-packages` | `requireTenantWorkspaceIdentity` | `{ ok, data: { items } }` | Tenant list of share packages. |
| `DELETE /api/tenant/share-packages/:id` | `requireTenantWorkspaceIdentity` | `{ ok, data: { id, status: "revoked" } }` | Tenant-owned revoke path. |
| `POST /api/tenant/share-packages/:id/respond` | `requireTenantWorkspaceIdentity` | `{ ok, data }` package response | Tenant response to package request. |
| `POST /api/tenant/share-packages/:id/verification-requests/:requestId/respond` | `requireTenantWorkspaceIdentity` | `{ ok, data }` verification response | Requires tenant identifier, package identifier, and request identifier. |
| `POST /api/tenant/share-packages/:id/verification-requests/:requestId/revoke` | `requireTenantWorkspaceIdentity` | `{ ok, data }` verification request | Revoke is tenant-scoped. |
| `GET /api/tenant/notification-preferences` | `requireTenantWorkspaceIdentity` | `{ ok, data }` preferences | Cross-device setting surface. |
| `PATCH /api/tenant/notification-preferences` | `requireTenantWorkspaceIdentity` | `{ ok, data }` preferences | Mutation should remain partial and tenant-scoped. |
| `GET /api/tenant/profile` | `requireTenantWorkspaceIdentity` | `{ ok, data }` tenant profile projection | Source is `loadTenantProfileProjection`. |
| `PATCH /api/tenant/profile` | `requireTenantWorkspaceIdentity` | `{ ok, data }` tenant profile projection | Profile updates are continuity-sensitive because application reuse and completion depend on them. |
| `GET /api/tenant/application-reuse` | `requireTenantWorkspaceIdentity` | `{ ok, data }` application reuse projection | Read-only projection for reuse eligibility. |
| `GET /api/tenant/communications` | `requireTenantWorkspaceIdentity` | `{ ok, data }` communications workspace | Workspace conversation state. |
| `POST /api/tenant/communications/messages` | `requireTenantWorkspaceIdentity` | `{ ok, data }` message | Requires tenancy context and message body constraints in service layer. |
| `POST /api/tenant/communications/read` | `requireTenantWorkspaceIdentity` | `{ ok }` | Read-state mutation; must remain idempotent. |
| `GET /api/tenant/notifications` | `requireTenantWorkspaceIdentity` | `{ ok, data }` notification feed | Derived feed from profile, lease, documents, and communications. |
| `GET /api/tenant/activity` | `requireTenantWorkspaceIdentity` | Same handler as notifications | Activity and notifications are currently coupled. |
| `GET /api/tenant/access` | `requireTenantWorkspaceIdentity` | `{ ok, data }` access workspace | Institution/share access control surface. |
| `POST /api/tenant/access/:shareId/revoke` | `requireTenantWorkspaceIdentity` | `{ ok, shareId, revoked }` | Tenant-owned share revoke. |
| `GET /api/tenant/application-status` | `requireTenantWorkspaceIdentity` | `{ ok, data }` application projection | Application continuity surface. |
| `GET /api/tenant/application-completion` | `requireTenantWorkspaceIdentity` | `{ ok, data }` completion summary | Used by checklist pages. |
| `GET /api/tenant/lease` | `requireTenantWorkspaceIdentity` before duplicate legacy route; later `requireTenant` lease route also exists | `{ ok, data }` tenant-safe lease projection | Duplicate route registration creates an ordering dependency; first workspace route handles normal requests. |
| `GET /api/tenant/lease/document-url` | `requireTenantWorkspaceIdentity` | `{ ok, data }` document URL response | Must only return tenant-safe document links. |
| `POST /api/tenant/leases/:leaseId/payments/checkout` | `requireTenantWorkspaceIdentity` | `{ ok, data: { rentPaymentId, status: "checkout_created", redirectUrl } }` | Payment checkout is continuity-sensitive and must verify lease scope. |
| `GET /api/tenant/leases/:leaseId/payments` | `requireTenantWorkspaceIdentity` | `{ ok, data }` payment summary | Lease-scoped payment read. |
| `POST /api/tenant/leases/:leaseId/sign` | `requireTenantWorkspaceIdentity` | `{ ok, data }` lease projection | Signature mutation tied to tenant lease. |
| `GET /api/tenant/maintenance-requests` | `requireTenantWorkspaceIdentity` before duplicate legacy route; later `requireTenant` list route also exists | `{ ok, data }` tenant-safe maintenance list | Duplicate registration; workspace route handles normal requests before legacy route. |
| `POST /api/tenant/maintenance-requests` | `requireTenantWorkspaceIdentity` before duplicate legacy route; later `requireTenant` create route also exists | `{ ok, data }` tenant-safe maintenance item | Create must preserve tenant/property context. |
| `POST /api/tenant/invite/redeem` | `requireTenantWorkspaceIdentity` | `{ ok, data }` invite redemption result | Redeems invite in context; continuity depends on token and tenant identity matching. |
| `GET /api/tenant/messages` | `requireTenant` | `{ ok, items, unreadCount }` | Legacy communications list. |
| `POST /api/tenant/messages/read-all` | `requireTenant` | `{ ok, updated }` | Read-state mutation. |
| `POST /api/tenant/messages/:id/read` | `requireTenant` | `{ ok }` | Message read-state mutation. |
| `POST /api/tenant/messages/maintenance/:requestId/read` | `requireTenant` | `{ ok }` | Maintenance-specific read-state mutation. |
| `POST /api/tenant/messages/screening/:requestId/read` | `requireTenant` | `{ ok }` | Screening-specific read-state mutation. |
| `GET /api/tenant/screening` | `requireTenant` | `{ ok, items }` | Tenant screening inbox. |
| `GET /api/tenant/screening/:requestId/status` | `requireTenant` | `{ ok, screeningRequest }` | Tenant-screening status detail. |
| `POST /api/tenant/screening/:requestId/consent` | `requireTenant` | `{ ok, screeningRequest }` | Consent mutation; must remain tenant-owned and append-safe. |
| `POST /api/tenant/screening/:requestId/start` | `requireTenant` | `{ ok, screeningRequest }` | Provider session start; provider payloads must not leak to tenant docs. |
| `POST /api/tenant/screening/:requestId/retry` | `requireTenant` | `{ ok, screeningRequest }` | Retry lifecycle mutation. |
| `POST /api/tenant/screening/provider/transunion/callback` | no `requireTenant` on route; callback endpoint inside tenant portal router after `authenticateJwt` | Provider callback shape | Requires separate careful review before changing; provider callback is not a normal tenant UI endpoint. |
| `GET /api/tenant/ledger` | `requireTenant` | `{ ok, data }` ledger list; duplicate legacy fallback route later returns static data | First ledger route imports ledger service; duplicate route order matters. |
| `GET /api/tenant/attachments` | `requireTenantWorkspaceIdentity` | `{ ok, data }` tenant attachment list | Must use tenant-safe document/evidence projection. |
| `GET /api/tenant/ledger/:ledgerItemId/attachments` | `requireTenant` | `{ ok, data }` ledger attachment list | Ledger item attachment scope must stay tenant-owned. |
| `GET /api/tenant/payments` | `requireTenant` | static/legacy payment response | Legacy endpoint; tenant payment continuity primarily uses lease payment endpoints and ledger. |
| `GET /api/tenant/notices` | `requireTenant` | `{ ok, data }` or `{ ok, items }` notice list depending caller | Tenant notices center. |
| `POST /api/tenant/notices/:noticeId/read` | `requireTenant` | `{ ok }` | Notice read-state mutation. |
| `GET /api/tenant/notices/:noticeId` | `requireTenant` | `{ ok, data }` notice detail | Detail must be tenant-owned. |
| `GET /api/tenant/communication/summary` | `requireTenant` | summary response | Unread and communication status summary. |
| `GET /api/tenant/maintenance` | `requireTenant` | `{ ok, data }` maintenance list alias | Alias for tenant maintenance list. |
| `GET /api/tenant/maintenance-requests/:id` | `requireTenant` | `{ ok, data }` maintenance detail | Detail must be tenant-owned. |
| `POST /api/tenant/maintenance/:id/reopen` | `requireTenant` | `{ ok, data }` maintenance item | Reopen lifecycle mutation. |
| `POST /api/tenant/maintenance/:id/signoff` | `requireTenant` | `{ ok, data }` maintenance item | Tenant signoff mutation. |
| `POST /api/tenant/maintenance/:id/rework-signoff` | `requireTenant` | `{ ok, data }` maintenance item | Duplicate route appears twice; ordering and behavior should be reviewed before future edits. |
| `POST /api/tenant/maintenance/:id/confirm-rework-access` | `requireTenant` | `{ ok, data }` maintenance item | Rework access confirmation. |
| `POST /api/tenant/maintenance-requests/:id/confirmation` | `requireTenant` | `{ ok, data }` maintenance item | Tenant schedule/access confirmation. |

### Tenant Lease Notices: `/api/tenant/lease-notices`

`tenantLeaseNoticeRoutes.ts` uses `authenticateJwt`, feature flag gating from `getLeaseNoticeWorkflowFlag`, and `requireTenant` from the authenticated user's tenant role and tenant identifier.

| Endpoint | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- |
| `GET /api/tenant/lease-notices` | Feature flag plus tenant role | `{ ok, items, data }` | Lists notice records where `tenantId` matches authenticated tenant. |
| `GET /api/tenant/lease-notices/:id` | Feature flag plus tenant role, `getLeaseForTenantWorkflow` | `{ ok, item, data, noResponse }` | Viewing appends `tenant_viewed_notice` workflow event and updates delivery status when needed. |
| `POST /api/tenant/lease-notices/:id/respond` | Feature flag plus tenant role, `getLeaseForTenantWorkflow` | `{ ok, item, data }` or error | Accepts `decision` of `renew` or `quit`; writes notice response, lease intent fields, and workflow event through a batch. |

### Tenant Participation and Onboarding Hardening: `/api/tenant`

| Endpoint | Auth pattern | Existing response shape | Projection notes |
| --- | --- | --- | --- |
| `GET /api/tenant/participation-profile` | `authenticateJwt` plus tenant role and tenant identifier | `{ ok, profiles }` | Sanitizes records to selected keys before deriving profile. Collections include rental applications, ledger events, verified rental history ledgers, maintenance requests, review records, dispute records, communications, evidence packs, and events. |
| `GET /api/tenant/participation-profile/:tenantParticipationId` | Same as list plus profile identifier lookup | `{ ok, profile }` | Profile must be found in the authenticated tenant's derived profile list. |
| `GET /api/tenant/onboarding-hardening` | `authenticateJwt` plus tenant role and tenant identifier | `{ ok, profiles }` | Sanitizes selected keys from rental applications, tenant invites, tenant profiles, tenants, screening readiness, access grants, consents, events, alerts, review sessions, evidence packs, and events. |

### Tenant Invites

| Endpoint | Route source | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- | --- |
| `POST /api/tenant-invites` | `tenantInvitesRoutes.ts` | `requireAuth`, landlord/admin role, rate limit | created invite response | Creates hashed invite records and should preserve single-use/expiry semantics. |
| `GET /api/tenant-invites` | `tenantInvitesRoutes.ts` | `requireAuth`, landlord/admin role | `{ items }` | Landlord/admin invite list. |
| `POST /api/tenant-invites/redeem` | `tenantInvitesRoutes.ts` | `requireAuth` | redemption response | Authenticated invite redemption. |
| `GET /api/tenant/invites/:token` | `tenantInviteAliasesRoutes.ts` | public token lookup | invite response or `NOT_FOUND` | Public lookup by token; token value must not be copied into documentation or logs. |
| `POST /api/tenant/invites/:token/accept` | `tenantInviteAliasesRoutes.ts` | public token acceptance | acceptance response | Accepts token-backed invite. |

### Tenant Magic-Link Entry

`publicRoutes.ts` is mounted at `/api` and `/api/public`. Tenant magic-link endpoints are public entry points that intentionally return generic success for request attempts so email enumeration is not exposed.

| Endpoint | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- |
| `POST /api/tenant/auth/magic-link` | Public email request; exact tenant email lookup; route masks email in logs | `{ ok: true }` for accepted, skipped, and most failure paths | Creates single-use `tenant_magic_links` record with expiry and sends a tenant login link when email delivery is configured. Token values must never be documented or logged directly. |
| `POST /api/tenant/auth/magic-redeem` | Public token redemption; validates unused and unexpired magic-link record | `{ ok, tenantToken, next }` or `MAGIC_LINK_INVALID` | Marks magic link used, signs tenant token with tenant role and context fields, and returns safe next path. |

### Tenant Events, Signals, Notices, Feedback, Reports

| Endpoint | Route source | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- | --- |
| `POST /api/tenant-events` | `tenantEventsRoutes.ts` | `authenticateJwt`, landlord role | event creation response | Landlord-created tenant events. |
| `GET /api/tenant/events` | `tenantEventsRoutes.ts` | `authenticateJwt`, tenant role | tenant event feed | Tenant reads own event feed. |
| `GET /api/tenant-events/signals` | `tenantEventsRoutes.ts` | `authenticateJwt`, landlord role | signals response | Landlord signal surface. |
| `POST /api/tenant-events` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | event creation response | Duplicate path with different auth middleware; mount order matters. |
| `GET /api/tenant-events` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | `{ ok, items, nextCursor }` | Landlord tenant-event read by query. |
| `GET /api/tenant-events/recent` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | `{ ok, items }` | Recent landlord tenant-event read. |
| `GET /api/tenant-events/score` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | score response | Landlord score read by tenant query. |
| `GET /api/ops/monthly-snapshot` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | monthly snapshot response | Operational snapshot read. |
| `GET /api/tenant-summaries` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | summary response | Landlord tenant summary read. |
| `POST /api/tenant-summaries/batch` | `tenantEventsWriteRoutes.ts` | `requireAuth`, landlord role | batch summary response | Landlord summary write/read helper. |
| `POST /api/tenant-notices` | `tenantNoticesRoutes.ts` | `authenticateJwt` | notice creation response | Notice creation; tenant reads through `/api/tenant/notices`. |
| `POST /api/tenant/feedback` | `tenantFeedbackRoutes.ts` | `requireAuth`, tenant role | `{ feedback: { id, createdAt } }` | Tenant feedback mutation. |
| `GET /api/tenant-report/tenants/:tenantId/report` | `tenantReportRoutes.ts` | `requireAuth`, landlord role | tenant report response | Landlord report read. |
| `GET /api/tenant-report-pdf/tenants/:tenantId/report.pdf` | `tenantReportPdfRoutes.ts` | `requireAuth`, landlord role | PDF response | Landlord PDF report. |
| `GET /api/tenants/:tenantId/signals` | `tenantSignalsRoutes.ts` | no route-local auth observed in file | tenant signals response | Mounted under broad `/api`; future edits should verify caller context before relying on this surface. |

### Landlord/Admin Tenant Management: `/api/tenants`

`tenantsRoutes.ts` applies `router.use(requireLandlord)`. The helper `getLandlordId` returns `null` for admin role and tenant-owned landlord identifier for landlord role, so admin can view across landlords while landlord calls are scoped to landlord ownership.

| Endpoint | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- |
| `GET /api/tenants` | landlord/admin via `requireLandlord` | `{ ok, tenants }` | List excludes hidden tenants from active lists. |
| `PATCH /api/tenants/:tenantId` | landlord/admin, ownership checked through detail bundle | `{ ok, tenant }` | Supports `fullName`, `email`, and `phone`; writes to tenant profile. |
| `GET /api/tenants/:tenantId` | landlord/admin, ownership checked through detail bundle | `{ ok, tenant, lease, currentLease, property, unit, latestLeaseNoticeSummary, payments, ledger, insights, credibilityInsights, moveInRequirements, moveInReadiness, ledgerSummary, lifecycle, stateCoherence }` | Primary landlord tenant detail bundle. |
| `GET /api/tenants/:tenantId/payments` | landlord/admin, ownership checked through detail bundle | payment array | Landlord-scoped payment history. |
| `GET /api/tenants/:tenantId/financial-activity` | landlord only; admin path with `null` landlord is rejected by this route | `{ ok, data: { rows } }` | Uses financial projection rows sorted by occurrence. |
| `GET /api/tenants/:tenantId/ledger` | landlord/admin, ownership checked through detail bundle | ledger array | Falls back to ledger service if bundle ledger is empty. |
| `GET /api/tenants/:tenantId/report` | landlord/admin, ownership checked; landlord requires `exports_basic` capability | PDF response or capability error | Export capability is enforced for landlord role. |
| `GET /api/tenants/:tenantId/move-in-readiness` | landlord/admin, ownership checked through detail bundle | `{ ok, readiness }` | Move-in continuity read. |
| `PATCH /api/tenants/:tenantId/move-in-readiness` | landlord/admin, ownership checked through detail bundle | `{ ok, readiness }` | Validates move-in keys and statuses; records actor as landlord/admin. |
| `GET /api/tenants/:tenantId/tenancies` | landlord/admin; admin uses unrestricted tenancy listing, landlord uses landlord scope | `{ ok, tenancies }` | Compatibility alias. |
| `OPTIONS /api/tenants/:tenantId/tenancies` | no auth action | empty `204` | CORS/preflight helper. |

### Admin Tenant Management: `/api/admin`

`adminTenantsRoutes.ts` uses `requireAuth` and `requirePermission("system.admin")`.

| Endpoint | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- |
| `GET /api/admin/tenants` | admin permission | `{ ok, items, total, page, pageSize, filters/sort metadata from service }` | Platform-wide admin view; records admin audit event `view_tenants`. |
| `GET /api/admin/tenants/export.csv` | admin permission | CSV response with generated filename | Records admin audit event `export_tenants_csv`; export is not tenant-facing. |

`adminTenantToolsRoutes.ts` contains `/create` and `/list` behind `requireAuth` and `requireRole(["landlord", "admin"])`, but this router is not mounted in `app.build.ts` in the audited state.

### Public Tenant Share Routes: `/api/public`

`publicTenantShareRoutes.ts` is token-based and intentionally not tenant-session based.

| Endpoint | Auth pattern | Existing response shape | Continuity notes |
| --- | --- | --- | --- |
| `GET /api/public/share/:token` | token lookup | `{ ok, data }` or `NOT_FOUND` | Reads a prepared public tenant share package by token. |
| `POST /api/public/share/:token/request` | token lookup | `{ ok, data }` requested items | Records recipient item request. |
| `POST /api/public/share/:token/verification-request` | token lookup | `{ ok, data }` requested scopes | Creates verification request with requester type set to landlord. |
| `POST /api/public/share/:token/apply` | token lookup | `{ ok, data }` application context | Reads apply context by token. |

### Tenant History Sharing: `/api/tenant-history`

`tenantHistoryShareRoutes.ts` exposes authenticated share creation/revocation and public token-based read paths. The service returns share URLs with tokenized paths. Token values are not documented here.

| Endpoint family | Auth pattern | Continuity notes |
| --- | --- | --- |
| Protected share creation and revoke endpoints | authenticated caller inside router | Must remain append-safe and token-safe. |
| Public history share and PDF read endpoints | token lookup | Must not expose raw internal records beyond tenant-safe shared history. |

### Legacy or Auxiliary Route Modules Not Mounted in `app.build.ts`

These files exist but were not observed in the production app mount table. They should not be treated as active tenant continuity surfaces until a future mission verifies mount status.

| Route module | Observed endpoints | Notes |
| --- | --- | --- |
| `tenantAuthRoutes.ts` | `POST /login`, `POST /logout` | Legacy JWT tenant login/logout router; frontend tenant auth currently uses other API paths. |
| `tenantLedgerRoutes.ts` | `GET /tenantLedger/:tenantId` | Legacy unguarded ledger helper. |
| `tenantLedger.ts` | `GET /:tenantId` | Legacy tenant ledger helper. |
| `tenantPayments.ts` | `GET /` | Static mock tenant payment list. |
| `tenantBalanceRoutes.ts` | balance summary route | Auxiliary balance route not mounted in audited app build. |
| `tenantAiRoutes.ts` | `POST /api/tenants/:tenantId/ai-insights` when mounted | Present in narrower app entry only; not in audited production mount table. |
| `adminTenantToolsRoutes.ts` | `POST /create`, `GET /list` | Auxiliary landlord/admin tenant tool router not mounted in audited app build. |

## Frontend Tenant Route Inventory

The active React route table in `rentchain-frontend/src/App.tsx` exposes these tenant-facing paths:

| UI path | Page/component | Primary API surfaces |
| --- | --- | --- |
| `/tenant/login` | `TenantLoginPage.v2.tsx` | `/api/tenant/auth/magic-link` through shared API fetch |
| `/tenant/magic` | `TenantMagicRedeemPage.tsx` | `/api/tenant/auth/magic-redeem` through shared API fetch |
| `/tenant/invite/:token` | `LegacyTokenInviteRedirect` or legacy invite component | Redirects to `/tenant/invite/redeem` with token preserved in query |
| `/tenant/apply`, `/tenant/apply/:token`, `/tenant/invite/redeem/:token`, `/tenant/invite/redeem` | `TenantInviteRedeemPage.tsx` and application entry helpers | `/api/tenant/invite/redeem`, invite alias APIs |
| `/tenant` | redirect/default tenant shell path | Tenant shell behavior |
| `/tenant/dashboard` | `TenantWorkspacePage.tsx` | `/api/tenant/workspace`, access, attachments, profile, completion, communications, screening, share packages, trust exports, institution access |
| `/tenant/application` | `TenantApplicationStatusPage.tsx` | `/api/tenant/application-completion`, profile, access, attachments, lease workspace, notification preferences |
| `/tenant/lease` | `TenantLeasePage.tsx` | `/api/tenant/lease`, `/api/tenant/lease/document-url`, lease sign/payment APIs |
| `/tenant/activity` | `TenantActivityPage.tsx` | `/api/tenant/notifications` |
| `/tenant/ledger` | `TenantLedgerPage.tsx` | `/api/tenant/ledger` |
| `/tenant/participation` | `TenantParticipationPage` | `/api/tenant/participation-profile` |
| `/tenant/onboarding-hardening` | `OnboardingHardeningPage` with tenant participant type | `/api/tenant/onboarding-hardening` |
| `/tenant/attachments`, `/tenant/documents` | `TenantAttachmentsPage.tsx` | `/api/tenant/attachments`, `/api/tenant/access`, `/api/tenant/lease` |
| `/tenant/notices` | `TenantNoticesCenterPage.tsx` | `/api/tenant/notices`, communications read APIs |
| `/tenant/notices/:noticeId` | `TenantNoticeDetailPage.tsx` | `/api/tenant/notices/:noticeId`, mark read API |
| `/tenant/lease-notices` | `TenantLeaseNoticesPage.tsx` | `/api/tenant/lease-notices` |
| `/tenant/lease-notices/:id` | `TenantLeaseNoticeDetailPage.tsx` | `/api/tenant/lease-notices/:id`, `/respond` |
| `/tenant/profile` | `TenantProfilePage.tsx` | `/api/tenant/profile`, attachments, workspace |
| `/tenant/screening` | `TenantScreeningInboxPage.tsx` | `/api/tenant/screening`, status, consent, start, retry, read |
| `/tenant/access` | `TenantAccessPage.tsx` | `/api/tenant/access`, revoke, institution/share APIs |
| `/tenant/account` | `TenantAccountPage.tsx` | `/api/tenant/me`, notification preferences |
| `/tenant/messages` | `TenantMessagesCenterPage.tsx` | `/api/tenant/messages`, communications workspace |
| `/tenant/maintenance` | `TenantMaintenanceRequestsPage.tsx` | `/api/tenant/maintenance-requests`, `/api/tenant/maintenance` |
| `/tenant/maintenance/new` | `TenantMaintenanceRequestNewPage.tsx` | `POST /api/tenant/maintenance-requests` |
| `/tenant/maintenance/:id` | `TenantMaintenanceRequestDetailPage.tsx` | maintenance detail, reopen, signoff, rework signoff, access confirmation |
| `/tenant/feedback` | `FeedbackSubmissionPage.tsx` | `POST /api/tenant/feedback` |
| `/share/:token` | `TenantSharePackagePage` | `/api/public/share/:token` family |
| `/tenants` | `TenantsPage` | landlord/admin tenant management APIs, not a tenant self-service page |
| `/admin/tenants` | `AdminTenantsPage` | admin tenant APIs, not tenant self-service |

Tenant API clients use `tenantApiFetch` for tenant-session requests. `tenantApiFetch` prefixes paths with `/api`, attaches the tenant bearer token from tenant auth storage when present, JSON-serializes plain-object bodies, maps `401` to `UNAUTHORIZED`, and throws on non-OK responses.

## Tenant Authority Model

`resolveTenancyContext` accepts a `TenantWorkspaceIdentity` with `uid`, `email`, `tenantId`, and `leaseId`. Authority is selected from candidates with these bases:

- `active_tenant`: tenant record, active lease, or active tenancy linkage.
- `applicant`: application or rental application linkage by applicant email, nested applicant email, applicant user identifier, user identifier, tenant identifier, or converted tenant identifier.
- `invite`: tenancy invite linkage by redeemed user or invited email, provided the invite has not expired.

The resolver fails closed when:

- no user identifier is present: `reason: "unauthenticated"`
- no authority candidates exist: `reason: "no_authority"`
- candidates span multiple properties: `reason: "ambiguous_authority"`

The winning context returns only relationship fields required for workspace resolution: `authority`, `propertyId`, `rc_prop_id`, `applicationId`, `leaseId`, `tenantId`, `unitId`, and `invitedEmail`.

## Authorization Boundary Diagram

```text
Tenant browser
  -> tenantApiFetch
  -> /api/tenant/*
  -> authenticateJwt
  -> requireTenantWorkspaceIdentity or requireTenant
  -> resolveTenancyContext
  -> tenant-safe projection services
  -> tenant workspace JSON

Landlord console
  -> /api/tenants/*
  -> requireLandlord
  -> landlordId scope unless role is admin
  -> tenant detail bundle / move-in readiness / reports

Admin console
  -> /api/admin/tenants*
  -> requireAuth
  -> requirePermission("system.admin")
  -> platform-wide tenant list/export

Public recipient
  -> /api/public/share/:token*
  -> token lookup
  -> public share package projection only
```

Boundary rules:

- Tenant routes must not derive authority from client-selected property or tenant identifiers alone.
- Landlord routes must validate ownership through landlord-scoped tenant detail loading, except explicit admin paths.
- Admin tenant routes require `system.admin`; admin audit events are written for list/export activity.
- Public share routes are token-scoped and must not become broad tenant search endpoints.

## Data Projection Inventory

### Tenant Workspace Projection

`tenantProjectionService.ts` defines explicit tenant projections.

| Projection | Visible field names |
| --- | --- |
| `TenantPropertyProjection` | `propertyId`, `rc_prop_id`, `street1`, `street2`, `city`, `province`, `postalCode`, `features` |
| `TenantLeaseProjection` | `leaseId`, `projectionProfile`, `projectionVersion`, `sensitivityClass`, `sourceCollections`, `sourceRefs`, `redactionSummary`, `startDate`, `endDate`, `monthlyRent`, `dueDay`, `status`, `documentUrl`, `signatureStatus`, `signatureReadinessLabel`, `signatureReadinessDescription`, `tenantSignature`, `leasePdfStatus`, `leasePdfLabel`, `leasePdfDescription`, `leaseExecution`, `paymentReadiness` |
| `TenantApplicationProjection` | `applicationId`, `status`, `missingSteps`, `nextActions`, `createdAt`, `updatedAt` |
| `TenantMaintenanceProjection` | `requestId`, `status`, `category`, `priority`, `title`, `summary`, `assignedContractorName`, `contractorStatus`, `serviceStartedAt`, `serviceCompletedAt`, `lastExecutionUpdateAt`, `completionSummary`, `completionOutcome`, `completionConfirmedByLandlordAt`, `reopenedAt`, `reopenedByActorId`, `reopenedByActorRole`, `reopenReason`, `serviceWindowStartAt`, `serviceWindowEndAt`, `accessRequired`, `tenantConfirmationStatus`, `tenantConfirmationUpdatedAt`, `accessAcknowledgedAt`, `resolutionStatus`, `landlordApprovedAt`, `tenantSignoffStatus`, `tenantSignedOffAt`, `tenantDeclinedAt`, `tenantDeclineReason`, `followUpRequired`, `followUpReason`, `finalResolvedAt`, `reworkCycle`, `reworkHistory`, `reworkReview`, `notifications`, `evidence`, `createdAt`, `updatedAt`, `statusHistory` |

`tenantSafeProjectionContract.ts` sets:

- `projectionName`: `tenant_safe_workspace_projection`
- `projectionVersion`: `tenant_safe_projection_v1`
- `audience`: `tenant_workspace`
- `scopeType`: `tenant_current_lease`
- `sensitivityClass`: `sensitive`
- `authorityBasis`: `authenticated_tenant_scope`
- allowed field groups: `tenant_visible_lease_summary`, `tenant_visible_document_status`, `tenant_signature_status`, `payment_readiness_summary`, `scoped_source_references`, `operational_labels`
- excluded field groups: `landlord_only_notes`, `other_tenant_records`, `raw_provider_payloads`, `raw_screening_reports`, `raw_csv_values`, `payment_account_details`, `debug_payloads`, `route_source_metadata`, `stack_traces`, `private_message_bodies`
- internal reference policy: internal references are scoped for navigation and traceability, not primary display labels

### Landlord/Admin Tenant Detail Projection

`tenantDetailsService.ts` returns landlord/admin detail bundles. Tenant management fields include:

- tenant: `id`, `landlordId`, `fullName`, `email`, `phone`, `hiddenFromActiveLists`, `cleanupReason`, `cleanupBatch`, `propertyId`, `applicationId`, `unitId`, `propertyName`, `unit`, `currentLeaseId`, `leaseStart`, `leaseEnd`, `monthlyRent`, `status`, `balance`, `riskLevel`, tenant score fields, `source`, `createdAt`, `lifecycle`
- lease/currentLease: `id`, `tenantId`, `propertyId`, `propertyName`, `propertyAddress`, `unitId`, `unit`, `leaseStart`, `leaseEnd`, `monthlyRent`, `status`
- unit: `id`, `unitNumber`, `status`, `rent`
- detail bundle: `latestLeaseNoticeSummary`, `payments`, `ledger`, `insights`, `credibilityInsights`, `moveInRequirements`, `moveInReadiness`, `ledgerSummary`, `lifecycle`, `stateCoherence`

This is not tenant self-service projection. It is landlord/admin operational projection and should remain separated from `/api/tenant/*` tenant-safe surfaces.

### Tenant-Visible Collections and Enforcement

| Collection/source | Tenant-visible use | Enforcement location | Redaction boundary |
| --- | --- | --- | --- |
| `tenants` | profile/workspace identity and account metadata | tenancy context service, profile service, tenant projection service | Tenant sees own profile/workspace fields only. |
| `leases` | current lease summary, readiness, signing, payment readiness | tenancy context service, tenant projection service, lease execution helpers | Excludes landlord-only notes, raw documents that are not tenant-safe, payment account details. |
| `properties` and `units` | tenant workspace labels and address fragments | tenant projection service and display projection helpers | Display fields only; raw IDs are not primary labels. |
| `applications` and `rentalApplications` | application status, completion, reuse | tenancy context service and profile/application completion services | Application summary fields only. |
| `maintenanceRequests` | maintenance list/detail and tenant mutations | tenant projection service and route-local tenant checks | Evidence filtered to `visibility: "tenant_safe"`. |
| `tenantMessages`, `tenantNotices`, communications records | message/notice centers and read state | tenant communications service and tenant portal routes | Private unrelated message bodies are excluded by projection contract. |
| `payments`, ledger events, lease payment records | ledger/payment continuity | tenant ledger service, rent payment service, lease payment projection | Payment account details excluded. |
| `leaseNotices` | lease notice list/detail/response | lease notice workflow service and tenant route guard | Tenant identifier matched in workflow lookup. |
| `tenantAccessGrants`, share package records, trust exports | access, sharing, exports | tenant access/share/export services | Public shares are token-scoped and tenant-controlled. |
| `screening` related records | screening inbox/status/consent | tenant portal routes and screening status adapter | Raw provider payloads and raw reports excluded from tenant projection. |
| `event_log`, `events` | activity, participation, onboarding hardening | event log service and derived profile services | Compact payloads and sanitized profile inputs. |

## Continuity Risk Matrix

| Operation | Auth/session risk | Projection risk | Ordering/atomicity risk | Cross-device risk | Tenant workflow impact |
| --- | --- | --- | --- | --- | --- |
| Login, magic link, invite redeem | Tenant token missing, expired, or invite context mismatch | Wrong authority could expose unrelated workspace | Invite redemption and workspace context may span invite, tenant, application, and lease records | Tenant starts on one device and resumes on another | Tenant cannot reach dashboard or sees no-authority/ambiguous-authority state. |
| Workspace load | Ambiguous property candidates or missing tenant identifier | Workspace bundle aggregates tenant, property, unit, application, lease, maintenance, identity, credibility, portability, and timeline | Multiple collection reads can drift if records update mid-load | Dashboard, application, profile, and lease pages depend on same context | Tenant shell may render inconsistent status across pages. |
| Lease view and signing | Lease identifier must match resolved tenant context | Tenant-safe lease projection must hide landlord-only and raw document data | Signing mutates lease signature fields and execution readiness | Signature state must be consistent after refresh | Tenant may see stale signature/readiness state. |
| Document and attachment access | Attachment requests must remain tenant/workspace scoped | Evidence must be tenant-safe; storage paths and raw provider payloads must stay hidden | Signed URL generation and attachment lists can drift | Download/open state can occur across devices | Tenant may lose continuity between document vault and lease/payment workflows. |
| Ledger and payment continuity | Lease payment routes must validate tenant lease scope | Payment account details excluded; ledger rows summarized | Checkout creation, payment summaries, and ledger entries are separate operations | Payment redirect can leave app and return later | Tenant may see checkout state without corresponding ledger update. |
| Communications and notices | Message/notices require tenant role or workspace context | Other tenant and private landlord/support messages excluded | Read-state updates should be idempotent | Read/unread state must sync across devices | Tenant may reread stale notices or miss required action. |
| Maintenance lifecycle | Request/detail/mutation must match tenant ownership | Maintenance projection includes tenant-safe evidence only | Create, reopen, signoff, rework signoff, and access confirmation alter lifecycle state | Tenant may file on mobile and review on desktop | Incorrect state can block repairs or close work prematurely. |
| Screening consent/start/retry | Screening request must be tenant-owned | Raw provider payloads and raw reports excluded | Consent, provider start, retry, and callbacks are multi-step | Tenant may consent on one device and check status elsewhere | Tenant could be stuck between consent and status update. |
| Share package/trust export/institution access | Tenant must own grant/export/package; public recipient uses token only | Public package projection must be limited to approved items/scopes | Create, request, respond, revoke, and resend are lifecycle operations | Tenant may revoke after recipient has opened link | Recipient access may outlive tenant intent if revoke is not consistently enforced. |
| Move-in readiness and tenant admin views | Landlord/admin route must validate ownership/permission | Landlord/admin projection must not flow back into tenant self-service | Readiness patch writes multiple status fields and event history | Landlord updates may need tenant visibility later | Tenant journey may diverge from landlord operational state. |

## Operational History and Audit

| History surface | Write path | Tenant visibility | Immutability/append-safety assumption |
| --- | --- | --- | --- |
| `event_log` | `recordTenantEvent` writes `event_type`, `entity_type`, `entity_id`, `context`, compact `payload`, `payload_ref`, `created_at`, `created_by`, `status` | Visible indirectly through activity, participation, onboarding hardening, and workspace-derived feeds | New events are appended with generated document IDs; compact payloads are capped by size policy. |
| Lease notice workflow events | `appendLeaseWorkflowEvent` inside lease notice view/respond flows | Visible through lease notice detail/list state | View/respond actions append workflow events and update notice/lease state in batches where implemented. |
| Tenant communications read state | tenant communications routes and services | Visible through messages/notices centers and unread counts | Read-state mutations should remain idempotent and should not erase source messages. |
| Maintenance status history | maintenance request projection includes `statusHistory`, rework cycle, rework history, and rework review | Visible in tenant maintenance detail | Lifecycle updates should append or preserve status history rather than overwrite evidence. |
| Admin audit events | `recordAdminAuditEvent` in admin tenant list/export routes | Not tenant-visible | Admin list/export actions are recorded separately from tenant self-service history. |
| Move-in readiness events | `tenantMoveInReadinessService` read/write paths | Landlord/admin-visible; tenant visibility depends on future surfaces | Readiness updates include actor role and should preserve event records. |
| Trust exports/share packages/institution access | tenant portal service lifecycle methods | Tenant-visible through access/export/share package pages and public token surfaces | Revoke, respond, resend, invalidation, and delivery state should be lifecycle updates rather than destructive mutation. |

## Mobile and Cross-Device Continuity Requirements

- Tenant token selection is centralized in `tenantApiFetch`, which attaches a bearer token from tenant auth storage. Missing token produces tenant API failures that pages generally route back to login.
- Tenant workspace state should be derived from backend context on each load; frontend pages should not persist authority decisions as source of truth.
- Read/unread states for messages, notices, maintenance, and screening must be server-backed so mobile and desktop remain consistent.
- Multi-step flows with redirect or external session boundaries are payment checkout, screening provider start, magic-link login, invite redeem, document download, and public share review.
- Pages under `TenantLayout` must tolerate refresh and direct deep links because routes such as `/tenant/maintenance/:id`, `/tenant/notices/:noticeId`, `/tenant/lease-notices/:id`, and `/tenant/screening` are direct-entry surfaces.
- Local UI mode helpers such as tenant workspace mode and application flow state are presentation helpers only; backend tenancy context remains authoritative.

## Tenant Workspace Projection Model

Tenant workspace state is resolved in this order:

1. The authenticated token produces `req.user` with role and identity fields.
2. `requireTenantWorkspaceIdentity` passes `uid`, `email`, `tenantId`, and `leaseId` to `resolveTenancyContext`.
3. `resolveTenancyContext` gathers tenant record, application, lease, tenancy, and invite candidates.
4. Candidates must resolve to exactly one property; otherwise the request fails closed.
5. The selected context provides property, application, lease, tenant, and unit references for workspace reads.
6. `loadTenantWorkspaceData`, profile services, identity timeline, credibility signals, and tenant-safe projections derive the final workspace response.

Workspace state impacts:

- dashboard cards and mode banner
- application checklist and reuse state
- lease readiness and signing
- document vault and attachment guidance
- payment readiness and ledger links
- maintenance list/detail actions
- communications and activity feed
- screening inbox and consent state
- access/share/export controls

## Overlaps and Duplicate Route Families

| Overlap | Current behavior | Continuity concern |
| --- | --- | --- |
| `GET /api/tenant/me` | Registered twice in `tenantPortalRoutes.ts`; first workspace-context handler appears before legacy tenant handler | Future edits must preserve intended ordering or remove ambiguity in a separate mission. |
| `GET /api/tenant/lease` | Workspace-context lease route appears before legacy tenant lease route | First route should remain the tenant-safe lease projection. |
| `GET /api/tenant/ledger` | Service-backed route appears before static/legacy fallback route | Future edits should verify which handler is reached in runtime. |
| `GET/POST /api/tenant/maintenance-requests` | Workspace-context routes appear before legacy tenant routes | Create/list behavior depends on route ordering. |
| `POST /api/tenant/maintenance/:id/rework-signoff` | Appears twice in `tenantPortalRoutes.ts` | Duplicate mutation path should be reviewed before future maintenance continuity changes. |
| `POST /api/tenant-events` | Appears in both `tenantEventsRoutes.ts` and `tenantEventsWriteRoutes.ts` | Mount order and middleware differ; future event continuity work should verify caller path. |
| `tenantDetailsRoutes.ts` and `tenantsRoutes.ts` | Similar `/api/tenants` paths; production app build mounts `tenantsRoutes.ts` | Legacy app entry may behave differently from production app build. |
| Unmounted legacy tenant modules | Route files exist but are not mounted in audited production app build | Do not treat as active surfaces without mount verification. |

## Key Dependencies for Phase 1 Missions 2-9

- Mission 2 should start from tenant auth/session continuity: magic-link request, magic redeem, invite redeem, token selection, and deep-link redirect handling.
- Mission 3 should start from workspace context continuity: `/api/tenant/workspace`, `/api/tenant/me`, tenant shell routing, and ambiguous-authority handling.
- Mission 4 should start from lease/document continuity: `/api/tenant/lease`, lease notices, attachments, and tenant-safe document URLs.
- Mission 5 should start from ledger/payment continuity: `/api/tenant/ledger`, lease payment summary, checkout creation, and redirect return state.
- Mission 6 should start from communications/notices continuity: messages, notices, notification preferences, activity feed, and read-state idempotency.
- Mission 7 should start from maintenance continuity: request creation, detail, reopen, access confirmation, signoff, and rework signoff.
- Mission 8 should start from screening/access/share continuity: screening status/consent/start/retry, access grants, trust exports, share packages, and public share review.
- Mission 9 should start from cross-device signoff: mobile tenant routes, refresh/deep-link behavior, and a final tenant continuity checklist.
- Keep `resolveTenancyContext` as the tenant workspace authority root.
- Keep `tenantSafeProjectionContract.ts` as the tenant projection boundary for workspace data.
- Treat `/api/tenant/workspace` as the primary dashboard continuity source.
- Treat duplicate `tenantPortalRoutes.ts` paths as ordering-sensitive until a future mission explicitly resolves them.
- Preserve tenant/landlord/admin route separation: `/api/tenant/*`, `/api/tenants/*`, and `/api/admin/tenants*` are different audiences.
- Do not promote unmounted legacy route modules into Phase 1 continuity scope without a separate mount verification mission.
- Any maintenance, screening, payment, share, export, or institution access change must verify ownership and append-safe lifecycle history.

## Acceptance Checklist

- [x] Tenant UI routes documented from `App.tsx`.
- [x] Tenant backend route families documented from route source and mount table.
- [x] Tenant workspace authority resolution documented.
- [x] Tenant-safe projection fields documented with exact field names.
- [x] Landlord/admin tenant management routes documented separately from tenant self-service.
- [x] Public token-based tenant share routes documented separately from authenticated tenant routes.
- [x] Continuity risk matrix covers login/invite, workspace, lease, documents, payments, communications, maintenance, screening, sharing, and move-in readiness.
- [x] Operational history and append-safe assumptions documented.
- [x] Cross-device continuity requirements documented.
- [x] Route overlaps and gaps requiring future clarification documented.

## Blockers and Gaps Discovered

- No blocking implementation issues were found because this mission is audit/documentation only.
- `tenantPortalRoutes.ts` contains duplicate route registrations for `me`, `lease`, `ledger`, `maintenance-requests`, and `maintenance/:id/rework-signoff`; these are documented as continuity risks and should not be changed without a dedicated mission.
- Several tenant-named route modules exist but are not mounted in `app.build.ts`; they are documented as legacy or auxiliary rather than active tenant continuity surfaces.
- `tenantSignalsRoutes.ts` exposes a tenant-signal read by tenant identifier without route-local auth in the audited file; because it is mounted under `/api`, a future mission should verify intended caller and boundary before relying on it for tenant continuity work.
- The provider callback inside `tenantPortalRoutes.ts` is not a normal tenant UI endpoint and should be treated as a separate integration surface for future screening continuity work.

## Ready State for Missions 2-9

This inventory is ready to be used as the Phase 1 navigation document. Future missions should use it as the route/projection checklist, then re-check the specific source files they touch before making changes.
