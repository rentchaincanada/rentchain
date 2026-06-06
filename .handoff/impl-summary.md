PR: #1105
PR URL: https://github.com/rentchaincanada/rentchain/pull/1105
Branch: feat/lease-execution-end-to-end-v1

# Implementation Summary

Implemented Phase B lease execution signing foundation with provider-neutral backend orchestration, mock local workflow, Dropbox Sign production boundary, landlord signing controls, tenant signing URL support, webhook ingestion, and architecture/reference documentation.

## Confirmed Findings

- Added provider-neutral signing interfaces, registry, mock provider, and Dropbox Sign adapter boundary under `rentchain-api/src/services/signing/providers/`.
- Added lease signing orchestration using separate `leaseSigningRequests`, `leaseSigningEvents`, and metadata-only webhook dead-letter records.
- Added derived lease signing state helper for `pending_signature`, `signed_future`, `active`, and terminal states without relying on broad lease status mutation.
- Added landlord endpoints for send, status, signed-document download, and cancellation under existing `/api/leases/:leaseId/*` route ownership checks.
- Added signing webhook routes at `/webhooks/signing/:providerId?` and `/api/webhooks/signing/:providerId?` with raw body handling before the JSON parser.
- Extended tenant portal lease routes with tenant-safe signing status and hosted signing URL support while preserving the existing in-app signature metadata path.
- Added landlord signing dashboard UI and tenant lease page redirect handling for provider-backed signing.
- Added signing provider env examples and pinned `@dropbox/sign` metadata to `1.10.0`.
- Added provider evaluation, schema, webhook, error-code, deployment checklist, and architecture documentation.

## Validation

- `git diff --check`: PASS
- `npm test --prefix rentchain-api -- src/services/__tests__/leaseSigningService.test.ts src/services/signing/providers/__tests__/mockSigningProvider.test.ts`: PASS
- `npm run build --prefix rentchain-api`: PASS
- `npm run build --prefix rentchain-frontend`: PASS
- `npm test --prefix rentchain-frontend`: PASS, 291 test files and 1149 tests
- `npm test --prefix rentchain-api`: FAIL due sandbox `listen EPERM: operation not permitted 0.0.0.0` across existing route tests; 419 files and 2030 tests passed before failure, with failures matching the known full-suite environment limitation.

## Manual QA Required

Manual QA is required because this mission touches backend routes, auth-boundary behavior, webhook routing, frontend rendering, and user-visible lease signing workflows.

Recommended manual QA:
1. With backend/frontend running and `SIGNING_PROVIDER=mock`, verify unauthenticated landlord signing routes return 401.
2. Log in as landlord, open active leases, send a lease for signature with a valid tenant email, and verify pending status appears.
3. Verify invalid tenant email returns a safe error code and no stack trace.
4. Log in as the involved tenant and verify tenant lease page shows provider signing status and opens the mock signing URL.
5. Verify a non-involved tenant cannot access or sign the lease.
6. Post a mock signed webhook to `/webhooks/signing/mock` and verify signing status becomes signed.
7. Attempt duplicate webhook delivery and verify the status remains stable.
8. Download signed document as landlord after signed webhook; verify a document URL is returned.
9. Attempt signed-document download before signed state; verify safe 404 response.
10. Cancel a pending request as landlord and verify tenant signing is no longer available.
11. Confirm tenant responses do not include provider request IDs, provider event IDs, webhook metadata, or landlord-only fields.
12. Confirm logs and stored signing events do not include API keys, webhook secrets, or raw provider payloads.

## Known Limitations

- Dropbox Sign adapter is isolated behind the provider interface and package metadata is pinned, but production API calls remain a boundary implementation pending real credentials and provider sandbox verification.
- Signed-document storage uses the existing GCS helper and requires bucket configuration before non-mock document retrieval in deployed environments.
- Full backend suite is not clean in this sandbox because multiple pre-existing route tests hit `listen EPERM` on `0.0.0.0`; focused signing tests and builds pass.
- E2E seeded-account workflow was not run locally because seeded accounts and provider sandbox credentials were not available.

## Files Changed

- `.env.example`
- `rentchain-api/.env.example`
- `rentchain-api/package.json`
- `rentchain-api/package-lock.json`
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/webhooks/signingWebhookRoutes.ts`
- `rentchain-api/src/services/leaseStateHelper.ts`
- `rentchain-api/src/services/signing/leaseSigningService.ts`
- `rentchain-api/src/services/signing/providers/*`
- `rentchain-api/src/services/__tests__/leaseSigningService.test.ts`
- `rentchain-frontend/src/api/leasesApi.ts`
- `rentchain-frontend/src/api/tenantPortal.ts`
- `rentchain-frontend/src/components/LeaseSigningDashboard.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantLeasePage.tsx`
- `docs/architecture/lease-execution-provider-integration-v1.md`
- `.handoff/signing-provider-evaluation.md`
- `.handoff/lease-signing-schema.md`
- `.handoff/signing-webhook-spec.md`
- `.handoff/signing-error-codes.md`
- `.handoff/lease-signing-deployment-checklist.md`

## Acceptance Criteria Status

- Provider-neutral signing service layer: PASS
- Mock signing workflow: PASS
- Landlord send/status/cancel/download routes: PASS
- Tenant projected status/sign URL route support: PASS
- Webhook validation and idempotent event append: PASS for mock and adapter boundary tests
- Projection safety for tenant responses: PASS by route shape and summary review
- Signed document storage path: PARTIAL, requires configured bucket for deployed verification
- End-to-end seeded workflow: NOT RUN, environment limitation
