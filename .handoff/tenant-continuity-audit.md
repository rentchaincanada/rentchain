# Tenant Continuity Audit

Source branch: docs/phase-f-tenant-portal-environment-v1

Audited source files:
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/App.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/tenantAuth.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/tenantApiFetch.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/tenantPortal.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantLoginPage.v2.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantMagicRedeemPage.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantInviteRedeemPage.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantMaintenanceRequestDetailPage.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantNoticeDetailPage.tsx
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantLeaseNoticeDetailPage.tsx
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts

## Frontend Tenant Routes

Tenant UI routes in /Users/rentchain/dev/rentchain/rentchain-frontend/src/App.tsx:

- /tenant
- /tenant/login
- /tenant/magic
- /auth/magic
- /tenant/invite/:token
- /tenant/apply
- /tenant/apply/:token
- /tenant/invite/redeem/:token
- /tenant/dashboard
- /tenant/application
- /tenant/screening/consent
- /tenant/lease
- /tenant/payments
- /tenant/activity
- /tenant/ledger
- /tenant/participation
- /tenant/onboarding-hardening
- /tenant/attachments
- /tenant/documents
- /tenant/notices
- /tenant/profile
- /tenant/screening
- /tenant/access
- /tenant/account
- /tenant/notices/:noticeId
- /tenant/lease-notices
- /tenant/lease-notices/:id
- /tenant/messages
- /tenant/maintenance
- /tenant/maintenance/new
- /tenant/maintenance/:id
- /tenant/feedback
- /tenant/invite/redeem
- /share/:token

RequireTenant wraps authenticated tenant shell pages. TenantPortalComingSoon is used when tenant portal feature gating disables tenant routes.

## Cross-Device Scenarios

| Scenario | Server-backed source | Client continuity | Risk | Phase G/H/I guidance |
| --- | --- | --- | --- | --- |
| Login and magic-link redemption | /api/tenant/auth/magic-link and /api/tenant/auth/magic-redeem through public route family | Token stored in sessionStorage and localStorage | Link redemption on one device does not automatically authenticate another device unless the token is redeemed there. | Keep re-auth and 401 handling visible. |
| Invite redemption | /api/tenant/invites/:token alias and /api/tenant/invite/redeem | Token storage after successful acceptance/redeem | Public token links can be opened on mobile or desktop; state must be server-backed after token exchange. | Do not trust client route token for authority after redeem. |
| Workspace load | /api/tenant/workspace | TenantWorkspacePage aggregates workspace, access, attachments, profile, completion, preferences, communications, screening, share packages, trust exports, and institution access | Partial API failures can produce stale section state. | UI polish should identify source of each section and avoid claiming all sections are fresh if one call fails. |
| Lease document access | /api/tenant/lease and /api/tenant/lease/document-url | Deep link /tenant/lease | Signed/document URLs can expire. | Refresh document URLs on view/open, not only initial page load. |
| Tenant rent checkout | /api/tenant/leases/:leaseId/payments/checkout | RedirectUrl leaves current page | External redirect can lose in-memory state. | Preserve server-backed payment status and show retry/reload path after return. |
| Communications | /api/tenant/communications and /api/tenant/communications/read | Messages page and workspace section | Read-state writes may race across devices. | Treat read mutations as idempotent and refresh unread count after write. |
| Legacy messages | /api/tenant/messages and read endpoints | TenantMessagesCenterPage | Legacy and workspace communications can diverge. | Preserve route distinctions until dedicated consolidation. |
| Notices | /api/tenant/notices, /api/tenant/notices/:noticeId, read endpoint | Deep link /tenant/notices/:noticeId | Read-state can differ between devices until reload. | Refresh detail and list after marking read. |
| Lease notices | /api/tenant/lease-notices/:id and respond | Deep link /tenant/lease-notices/:id | Viewing may write delivery state; response writes lease intent. | Avoid duplicate response submission on back/refresh. |
| Maintenance detail | /api/tenant/maintenance-requests/:id and lifecycle mutations | Deep link /tenant/maintenance/:id | Route parameter may be hashed tenant-safe id while backend detail lookup must remain tenant-scoped. | Ensure detail refresh after signoff, reopen, confirmation, or rework decisions. |
| Screening consent/start | /api/tenant/screening/:requestId/consent and start | /tenant/screening and /tenant/screening/consent | Provider start can redirect or depend on configured provider state. | Keep error messages safe and reload server status after provider flow. |
| Share/export/institution access | /api/tenant/share-packages, trust-exports, institution-access | /tenant/access and workspace cards | Grants and revokes can be issued from different devices. | Always reload server list after revoke/create. |
| Notification preferences | /api/tenant/notification-preferences | /tenant/account or workspace settings | Preferences stored server-side but controls can be stale across tabs. | Confirm update response is rendered as source of truth. |

## Deep-Link Pages

Deep-link pages requiring server-backed validation:

- /tenant/maintenance/:id
- /tenant/notices/:noticeId
- /tenant/lease-notices/:id
- /tenant/screening/consent
- /tenant/invite/redeem
- /auth/magic
- /share/:token

The deep-link contract is that route params are navigation hints only. Authority and record access must be revalidated by the backend route on each load.

## State Persistence

- Tenant auth token persists in localStorage and sessionStorage under rentchain_tenant_token.
- getTenantToken rejects expired tokens based on JWT exp.
- tenantApiFetch sends Authorization only when a valid tenant token is available.
- On 401, tenantApiFetch throws an error with status 401 and payload { error: "UNAUTHORIZED" }; redirect/logout behavior is handled by callers and wrappers.
- Tenant workspace data is server-backed and should be reloaded after mutation-heavy flows.

## Continuity-Sensitive Duplicate Routes

- /api/tenant/me, /api/tenant/lease, /api/tenant/ledger, /api/tenant/maintenance-requests, and /api/tenant/maintenance/:id/rework-signoff have duplicate registrations in tenantPortalRoutes.ts.
- Current behavior depends on Express registration order. Phase G UI changes should not assume duplicate route consolidation.
- Phase H rules work should document backend query requirements without changing router ordering.
