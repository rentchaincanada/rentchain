# Tenant Portal Environment Map v1

Phase: v0.9 Phase F

This document is the canonical tenant portal environment reference for Phase G tenant UI polish, Phase H Firestore rules hardening, and Phase I soft launch readiness. It is documentation-only and does not change routes, auth, projections, configuration, deployment, or runtime behavior.

Primary audited files:
- /Users/rentchain/dev/rentchain/rentchain-api/src/app.build.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenancyContextService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantProjectionService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/config/firestoreEnvironmentGuard.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/App.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/tenantAuth.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/tenantApiFetch.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/vercel.json
- /Users/rentchain/dev/rentchain/firestore.rules
- /Users/rentchain/dev/rentchain/docs/phase-1/tenant-operational-continuity-map-v1.md
- /Users/rentchain/dev/rentchain/docs/environment/preview-staging-separation-strategy-v1.md

Supporting audit files:
- /Users/rentchain/dev/rentchain/.handoff/tenant-route-audit.md
- /Users/rentchain/dev/rentchain/.handoff/tenant-authority-audit.md
- /Users/rentchain/dev/rentchain/.handoff/tenant-projection-audit.md
- /Users/rentchain/dev/rentchain/.handoff/tenant-environment-audit.md
- /Users/rentchain/dev/rentchain/.handoff/tenant-continuity-audit.md

## Tenant Authority Model

Tenant workspace authority is resolved by /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenancyContextService.ts. The authority bases are active_tenant, applicant, and invite.

Server-side identity input:
- req.user.id becomes uid.
- req.user.email becomes normalized email.
- req.user.tenantId becomes tenantId.
- req.user.leaseId can seed lease lookup when present.

Firestore authority query paths:
- tenants doc(tenantId)
- tenants where tenantId == tenantId
- tenants where email == normalized email
- applications and rentalApplications where applicantEmail, email, applicant.email, applicantUserId, userId, tenantId, or convertedTenantId match the authenticated identity
- leases where tenantId, tenantIds array-contains, tenantEmail, email, or doc(leaseId) match the authenticated identity
- tenancies where tenantId == tenantId and status == active
- tenancy_invites where redeemed_by_uid == uid or invited_email == normalized email
- properties doc(propertyId) for rc_prop_id resolution

Fail-closed outcomes:
- Missing uid returns unauthenticated context and workspace routes return 401 UNAUTHORIZED.
- No authority returns no_authority and workspace routes return 409 TENANT_NOT_INITIALIZED.
- Multiple property authorities return ambiguous_authority and workspace routes return 403 AMBIGUOUS_TENANCY_CONTEXT.
- Missing tenant role or tenantId returns 401 UNAUTHORIZED before context resolution.

The resolved context fields are authority, propertyId, rc_prop_id, applicationId, leaseId, tenantId, unitId, and invitedEmail. Client-provided route params are navigation hints; tenant authority must be revalidated by backend context or tenant role guards.

## Tenant Route Map

Primary self-service mount: /api/tenant from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts.

Key tenant workspace endpoints:
- GET /api/tenant/workspace: requireTenantWorkspaceIdentity, response { ok, data } with context, tenant, landlord label, property, unit, application, lease, maintenance, identity, credibility, portability, and identity timeline.
- GET /api/tenant/me: duplicate registration; first handler is workspace summary with requireTenantWorkspaceIdentity.
- GET/PATCH /api/tenant/profile: profile projection/update.
- GET /api/tenant/application-status, /api/tenant/application-completion, /api/tenant/application-reuse: application and completion projections.
- GET /api/tenant/lease and GET /api/tenant/lease/document-url: tenant-safe lease and document URL status.
- POST /api/tenant/leases/:leaseId/payments/checkout and GET /api/tenant/leases/:leaseId/payments: lease-scoped payment checkout/status.
- POST /api/tenant/leases/:leaseId/sign: tenant lease signing mutation.
- GET /api/tenant/ledger and GET /api/tenant/attachments: ledger and document surfaces.
- GET/POST /api/tenant/communications, /api/tenant/messages, /api/tenant/notifications, and read-state endpoints: communications and activity.
- GET/POST /api/tenant/maintenance-requests plus maintenance detail, signoff, reopen, confirmation, and rework endpoints.
- GET/POST /api/tenant/screening and screening request status, consent, start, retry endpoints.
- GET/POST /api/tenant/share-packages, /api/tenant/trust-exports, /api/tenant/institution-access, and /api/tenant/institutional/handoffs: tenant-controlled sharing/export/institution access.
- GET/POST /api/tenant/notices and /api/tenant/lease-notices route families: notice list/detail/read/respond.

Adjacent route families:
- /api/tenant/participation-profile from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantParticipationRoutes.ts.
- /api/tenant/onboarding-hardening from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantOnboardingHardeningRoutes.ts.
- /api/tenant/feedback from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantFeedbackRoutes.ts.
- /api/tenant/invites/:token aliases from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantInviteAliasesRoutes.ts.
- /api/public/share/:token from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/publicTenantShareRoutes.ts.
- /api/tenants/* from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantsRoutes.ts for landlord/admin management.
- /api/admin/tenants* from /Users/rentchain/dev/rentchain/rentchain-api/src/routes/adminTenantsRoutes.ts for admin inspection.

Full route tables are in /Users/rentchain/dev/rentchain/.handoff/tenant-route-audit.md.

## Projection Contract

Tenant projection metadata:
- projectionVersion tenant_safe_projection_v1
- audience tenant_workspace
- sensitivityClass sensitive
- authorityBasis authenticated_tenant_scope
- projectionProfile
- redactionSummary
- sourceCollections
- sourceRefs

Tenant-safe field groups are whitelisted by scope in /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts. Excluded groups include landlord_only_notes, other_tenant_records, raw_provider_payloads, raw_screening_reports, raw_csv_values, payment_account_details, debug_payloads, route_source_metadata, stack_traces, private_message_bodies, storage_paths, provider_delivery_payloads, landlord_internal_workflow_state, raw_financial_transaction_ids, payment_provider_references, settlement_metadata, and internal_ledger_ids.

Field-level projection whitelists:
- Property: propertyId, rc_prop_id, street1, street2, city, province, postalCode, features, metadata.
- Lease: leaseId, startDate, endDate, monthlyRent, dueDay, status, documentUrl, signature status/readiness fields, tenantSignature safe fields, lease PDF status fields, leaseExecution, paymentReadiness, metadata.
- Application: applicationId, status, missingSteps, nextActions, createdAt, updatedAt, metadata.
- Maintenance: tenant-safe reference requestId, lifecycle status fields, schedule/access/signoff/rework fields, tenant-safe evidence fields, read-state fields, statusHistory safe fields, metadata.
- Profile: context summary, displayName, email, phone, authorityLabel, property, unit, application, lease, identity verification and checklist fields, metadata.
- Application reuse: applicant, current address, time at address, current rent amount, employment, work reference, next of kin, metadata.
- Communications: canSend, canSendReason, thread id, landlord label, property/unit references, unread count, last message time, tenant-visible messages, metadata.
- Notifications: id, type, title, summary, createdAt, status, relatedPath, sourceRefs, read, readAt.

Projection caution: projectTenantLease and projectTenantProperty currently expose scoped leaseId/propertyId values for navigation/traceability. They must not be used as user-facing display labels, and Phase H should account for backend scope checks rather than assuming client-side redaction is sufficient.

## Environment Controls

Production:
- Vercel production frontend uses /api and /health rewrites to the Cloud Run backend host configured in /Users/rentchain/dev/rentchain/rentchain-frontend/vercel.json.
- Backend production mode is accepted by /Users/rentchain/dev/rentchain/rentchain-api/src/config/firestoreEnvironmentGuard.ts.
- Tenant safety depends on backend authorization and projection logic.

Preview:
- Current committed /api and /health rewrites point to the production Cloud Run host.
- Preview tenant QA is production-adjacent unless platform environment routing is changed.
- Do not use production-sensitive tenant accounts for destructive preview checks.

Development and test:
- FIRESTORE_EMULATOR_HOST is required outside production unless ALLOW_LOCAL_PROD_FIRESTORE=true.
- GOOGLE_APPLICATION_CREDENTIALS is prohibited outside production unless ALLOW_LOCAL_PROD_FIRESTORE=true.
- .github/workflows/ci.yml sets VITE_API_BASE_URL to http://localhost:3000 for frontend jobs.
- firestore.rules is documented as local emulator only and currently allows all document reads/writes; Phase H must separately harden production rules.

Tenant API and auth:
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/tenantAuth.ts stores tenant JWTs under rentchain_tenant_token in sessionStorage and localStorage.
- Expired JWTs are rejected by getTenantToken.
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/tenantApiFetch.ts attaches Authorization: Bearer <tenant token> and normalizes tenant paths under /api.
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/baseUrl.ts requires absolute VITE_API_BASE_URL and strips trailing /api.

## Cross-Device Continuity

Continuity risks and controls:
- Login/magic link: token redemption is per browser/device; server authority is rechecked after token storage.
- Invite redemption: public token is only an entry point; tenant workspace access must resolve through authenticated tenant context after redemption.
- Workspace load: /api/tenant/workspace is the primary server-backed source; TenantWorkspacePage also loads access, attachments, profile, completion, notification preferences, communications, screening, share packages, trust exports, and institution access.
- Lease/document access: document URLs may expire and should be refreshed from /api/tenant/lease/document-url.
- Payment checkout: /api/tenant/leases/:leaseId/payments/checkout can leave the app through redirectUrl; status must be refreshed from the backend on return.
- Communications/notices/read-state: read writes should be treated as idempotent and followed by server refresh.
- Maintenance detail: /tenant/maintenance/:id must load server detail and refresh after signoff, reopen, confirmation, or rework actions.
- Screening: consent/start/retry must reload server status after provider activity or failure.
- Share/export/institution access: list/create/revoke flows can happen across devices and should reload server lists after mutation.

Deep-link pages requiring backend validation:
- /tenant/maintenance/:id
- /tenant/notices/:noticeId
- /tenant/lease-notices/:id
- /tenant/screening/consent
- /tenant/invite/redeem
- /auth/magic
- /share/:token

## Duplicate Route Handling

Duplicate registrations currently documented:
- /api/tenant/me
- /api/tenant/lease
- /api/tenant/ledger
- /api/tenant/maintenance-requests GET and POST
- /api/tenant/maintenance/:id/rework-signoff
- /api/tenant-events across tenantEventsRoutes.ts and tenantEventsWriteRoutes.ts

Current behavior depends on Express registration order. Do not reorder, merge, or remove these handlers in Phase G/H/I without a dedicated route consolidation mission and regression tests.

## Tenant Versus Landlord/Admin Boundaries

Tenant self-service:
- /api/tenant/* routes are tenant role or tenant workspace context routes.
- Response bodies should use tenant-safe projections and scoped references.
- Tenant UI routes in /Users/rentchain/dev/rentchain/rentchain-frontend/src/App.tsx are wrapped by RequireTenant for authenticated pages.

Landlord/admin management:
- /api/tenants/* routes use /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantsRoutes.ts and requireLandlord.
- /api/admin/tenants* routes use /Users/rentchain/dev/rentchain/rentchain-api/src/routes/adminTenantsRoutes.ts and require admin permissions.
- Tenant detail bundles, landlord reports, tenant report PDFs, and tenant event write routes are not tenant workspace projections.

Public token routes:
- /api/public/share/:token and /share/:token are token-scoped public review routes.
- /api/tenant/invites/:token is a public invite lookup/accept alias.
- Public token values must not be copied into logs, documentation examples, or user-facing labels.

## Known Gaps For Phase G/H/I

- Production Firestore rules hardening remains Phase H.
- Preview currently reaches production Cloud Run through committed rewrites, making preview tenant QA production-adjacent.
- Duplicate tenant route registrations are continuity-sensitive and need a dedicated consolidation mission before cleanup.
- Some legacy tenant routes remain in the repository but are not mounted in /Users/rentchain/dev/rentchain/rentchain-api/src/app.build.ts.
- Full cross-device QA requires seeded tenant accounts and environment-specific backend routing clarity.
- Provider-backed screening and payment redirect flows require configured provider test mode to validate full browser round trips.

## Acceptance Checklist

- Tenant route inventory documented: yes, see /Users/rentchain/dev/rentchain/.handoff/tenant-route-audit.md.
- Tenant authority resolution documented with Firestore query paths: yes, see /Users/rentchain/dev/rentchain/.handoff/tenant-authority-audit.md.
- Tenant projection field whitelists documented: yes, see /Users/rentchain/dev/rentchain/.handoff/tenant-projection-audit.md.
- Environment separation controls documented: yes, see /Users/rentchain/dev/rentchain/.handoff/tenant-environment-audit.md.
- Cross-device continuity scenarios documented: yes, see /Users/rentchain/dev/rentchain/.handoff/tenant-continuity-audit.md.
- Duplicate route handling documented: yes.
- Tenant versus landlord/admin/public token boundaries separated: yes.
- Phase 1 continuity map incorporated: yes, /Users/rentchain/dev/rentchain/docs/phase-1/tenant-operational-continuity-map-v1.md was used as a reference and current source files were rechecked.
- Preview/staging separation strategy incorporated: yes, /Users/rentchain/dev/rentchain/docs/environment/preview-staging-separation-strategy-v1.md was used as a reference and current source files were rechecked.
