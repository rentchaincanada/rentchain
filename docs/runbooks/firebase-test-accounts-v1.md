# Firebase Test Accounts Runbook v1

## Purpose

This runbook documents the current RentChain role model for controlled preview and staging test accounts. It is for operators who need to create landlord, tenant, contractor, and admin test access without changing authorization code or production data.

The runbook is based on repository inspection only. Do not paste passwords, bearer tokens, Firebase service account keys, provider payloads, or raw production document identifiers into this document or into issue comments.

## Scope

Use this document for:

- Creating preview or staging Firebase Auth users.
- Creating matching Firestore profile documents.
- Minting or validating application session claims through existing login and invite flows.
- Associating seeded properties, units, leases, work orders, and invites with test accounts.
- Verifying role separation before pilot QA.

Do not use this document to:

- Create or modify production user accounts.
- Add new auth routes or custom-claim setters.
- Change Firestore rules.
- Change billing, screening, signing, or provider credentials.
- Store credentials in the repository.

## Audited Files

Backend auth and role model:

- `rentchain-api/src/auth/jwt.ts`
- `rentchain-api/src/auth/rbac.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`
- `rentchain-api/src/middleware/requireAuth.ts`
- `rentchain-api/src/middleware/requireLandlord.ts`
- `rentchain-api/src/middleware/requireContractor.ts`
- `rentchain-api/src/middleware/requireAdmin.ts`
- `rentchain-api/src/middleware/requireRole.ts`
- `rentchain-api/src/middleware/requireAuthz.ts`
- `rentchain-api/src/services/authService.ts`
- `rentchain-api/src/services/sessionUserService.ts`
- `rentchain-api/src/services/entitlementsService.ts`
- `rentchain-api/src/services/accountService.ts`
- `rentchain-api/src/services/landlordProfileService.ts`
- `rentchain-api/src/routes/authRoutes.ts`
- `rentchain-api/src/routes/authMeRoutes.ts`
- `rentchain-api/src/routes/tenantAuthRoutes.ts`
- `rentchain-api/src/routes/devAuthRoutes.ts`
- `rentchain-api/src/routes/devMintRoutes.ts`
- `rentchain-api/src/routes/contractorPortalRoutes.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/app.build.ts`

Data and rules:

- `firestore.rules`
- `firebase.json`
- `rentchain-api/src/db/onboardingRepo.ts`
- `rentchain-api/src/services/tenantPortal/tenantInviteService.ts`
- `rentchain-api/src/services/tenantPortal/tenancyContextService.ts`
- `rentchain-api/src/services/contractorPortalService.ts`

Frontend auth:

- `rentchain-frontend/src/context/AuthContext.tsx`
- `rentchain-frontend/src/api/authApi.ts`
- `rentchain-frontend/src/api/tenantAuthApi.ts`
- `rentchain-frontend/src/lib/authToken.ts`
- `rentchain-frontend/src/lib/tenantAuth.ts`
- `rentchain-frontend/src/components/auth/RequireRole.tsx`
- `rentchain-frontend/src/components/auth/RequireTenant.tsx`
- `rentchain-frontend/src/components/auth/RequireAdmin.tsx`

## High-Level Finding

RentChain does not currently expose a repository function that calls Firebase Admin `setCustomUserClaims`. The app uses Firebase Auth for user creation and password validation, then mints its own application JWTs through `signAuthToken` or legacy JWT helpers.

The effective role model is split across:

- Firebase Auth user: email, password, disabled state, email verification.
- Firestore profile documents: `users`, `accounts`, `landlords`, `tenants`, and `contractorProfiles`.
- Application JWT claims: `sub`, `email`, `role`, role-specific scope fields, permission arrays, and `ver`.
- Firestore rules: direct-client defense-in-depth checks against `request.auth.token.role`, `landlordId`, and `tenantId`.

For pilot accounts, create the Firebase Auth user first, then create the matching Firestore profile documents and verify the app-issued session token resolves through `GET /api/me`.

## Role Values

The primary pilot role values are:

| Role | Use For | Primary Middleware | Notes |
| --- | --- | --- | --- |
| `landlord` | Property, lease, billing, screening, tenant management | `requireLandlord` | `landlordId` usually equals the Firebase Auth UID for direct landlord accounts. |
| `tenant` | Tenant portal and tenant-safe lease/workspace access | tenant guards in `tenantPortalRoutes.ts` | Requires `tenantId`; often linked through invite redemption and tenant documents. |
| `contractor` | Contractor portal work orders and messages | `requireContractor` | Requires `contractorId`; defaults to user ID when omitted. |
| `admin` | Admin and support operations | `requireAdmin`, admin route-local checks | Can also be granted by admin email or subject allowlists in env for some routes. |

Additional role values exist in code or rules and should not be used for basic pilot accounts unless explicitly scoped: `owner`, `manager`, `staff`, `auditor`, `support`, and `operator`.

## Application JWT Claim Contract

`rentchain-api/src/auth/jwt.ts` defines the canonical v1 application JWT shape:

| Claim | Required | Applies To | Meaning |
| --- | --- | --- | --- |
| `sub` | yes | all roles | Auth subject used as app user ID. |
| `email` | recommended | all roles | Account email used for display and lookups. |
| `role` | yes | all roles | One of the role values above. |
| `landlordId` | role-dependent | landlord, tenant, admin context | Landlord scope for property, lease, billing, and tenant relationships. |
| `tenantId` | tenant only | tenant | Tenant scope for tenant portal and tenant-safe records. |
| `permissions` | optional | admin/landlord/contractor | Extra permission grants. Usually `[]` for test accounts. |
| `revokedPermissions` | optional | admin/landlord/contractor | Permission removals. Usually `[]` for test accounts. |
| `realActorId` | optional | impersonation only | Original actor for impersonated sessions. |
| `realActorRole` | optional | impersonation only | Original actor role. |
| `effectiveActorId` | optional | impersonation only | Effective target actor. |
| `effectiveActorRole` | optional | impersonation only | Effective target role. |
| `impersonationSessionId` | optional | impersonation only | Active impersonation session marker. |
| `impersonationReason` | optional | impersonation only | Reason text for supervised impersonation. |
| `impersonationStartedAt` | optional | impersonation only | Timestamp for supervised impersonation. |
| `ver` | yes | all roles when using `signAuthToken` | Claim contract version, currently `1`. |

Legacy token helpers in `authService.ts`, `tenantAuthRoutes.ts`, and dev-only routes may omit `ver`. Route-level `requireAuth` expects `verifyAuthToken` output and then hydrates a canonical session user.

## Firestore Profile Collections

### `users/{userId}`

Canonical user profile and entitlements source. `sessionUserService.ts` reads this collection when `AUTH_HYDRATE_FROM_DB=true`, and `entitlementsService.ts` reads it for role and plan derivation.

Expected pilot fields:

| Field | Role Use | Notes |
| --- | --- | --- |
| `id` | all | Same as the Auth user UID or app subject. |
| `email` | all | Lowercase account email. |
| `role` | all | `landlord`, `tenant`, `contractor`, or `admin`. |
| `landlordId` | landlord, tenant context | Required for landlord. Tenant tokens should carry landlord scope; tenant profile docs should link to landlord where applicable. Contractor user docs set this to `null`. |
| `tenantId` | tenant | Required for hydrated tenant accounts if using `users` as a profile source. |
| `contractorId` | contractor | Usually same as user ID. |
| `contractorLandlordIds` | contractor | Array of landlord scopes that invited or can work with the contractor. |
| `plan` | landlord/admin | `free`, `starter`, `pro`, `elite`, or legacy plan values resolved by entitlement code. |
| `status` | all | Use `active` for enabled test accounts. |
| `approved` | landlord/contractor | `true` for active pilot test accounts. |
| `approvedAt` | landlord/contractor | Timestamp value. |
| `approvedBy` | landlord/contractor | Operator-safe reason such as `pilot_setup`. |
| `permissions` | optional | Usually `[]`. |
| `revokedPermissions` | optional | Usually `[]`. |
| `disabled` | all | If `true`, `requireAuth` rejects with account disabled. Omit or set `false` for active tests. |
| `createdAt` | all | Timestamp value. |
| `updatedAt` | all | Timestamp value. |

### `accounts/{accountId}`

Account and entitlement mirror. For landlord accounts, `accountId` is the landlord ID. Contractor signup mirrors role and contractor fields here. `sessionUserService.ts` merges `accounts` and `users` during DB hydration.

Expected landlord fields:

| Field | Notes |
| --- | --- |
| `id` | Landlord account ID. |
| `ownerUserId` | Same as landlord user ID for simple landlord accounts. |
| `email` | Lowercase account email where present. |
| `role` | `landlord` for landlord test account. |
| `landlordId` | Same as account ID. |
| `plan` | Pilot tier. |
| `planStatus` | Use `active` for active tests if present. |
| `entitlements` | Plan-derived entitlement object when created by account service. |
| `usage` | Optional usage counters. |
| `approved` | `true` for active tests. |
| `createdAt` | Timestamp value. |
| `updatedAt` | Timestamp value. |

Expected contractor fields:

| Field | Notes |
| --- | --- |
| `id` | Contractor user ID. |
| `email` | Lowercase contractor email. |
| `role` | `contractor`. |
| `contractorId` | Contractor user ID. |
| `contractorLandlordIds` | Array of associated landlord IDs. |
| `landlordId` | `null`. |
| `status` | `active`. |
| `approved` | `true`. |
| `createdAt` | Timestamp value. |
| `updatedAt` | Timestamp value. |

### `landlords/{landlordId}`

Landlord profile and plan source. `authService.ts`, `landlordProfileService.ts`, and `entitlementsService.ts` read this collection. Landlord signup writes this document.

Expected fields:

| Field | Notes |
| --- | --- |
| `id` | Landlord ID. |
| `landlordId` | Same value. |
| `email` | Lowercase landlord email. |
| `role` | `landlord`. |
| `plan` | Pilot tier. |
| `planStartedAt` | Timestamp string when created by legacy profile service. |
| `approved` | `true` for active tests. |
| `approvedAt` | Timestamp value. |
| `approvedBy` | Operator-safe reason such as `pilot_setup`. |
| `createdAt` | Timestamp value. |
| `updatedAt` | Timestamp value. |

### `tenants/{tenantId}`

Tenant authority and tenant portal context. Tenant invite redemption and tenant onboarding write this document. Tenant portal routes require `role=tenant` and a non-empty `tenantId` claim.

Expected fields:

| Field | Notes |
| --- | --- |
| `id` | Tenant ID. |
| `tenantId` | Same value. |
| `landlordId` | Landlord scope for this tenant. |
| `email` | Lowercase tenant email. |
| `fullName` | Test display name. |
| `phone` | Optional test phone. |
| `propertyId` | Seeded property reference for the tenancy. |
| `unitId` | Seeded unit reference. |
| `unit` | Often mirrors `unitId` or unit label. |
| `leaseId` | Current lease reference, if seeded. |
| `currentLeaseId` | Current lease reference, if seeded. |
| `applicationId` | Application reference, if seeded. |
| `applicantUserId` | Auth user ID for the invite-accepted account when applicable. |
| `source` | Use `invite`, `manual_pilot_setup`, or equivalent operator-safe source. |
| `status` | Use `active` for login paths that check status. |
| `createdAt` | Timestamp value. |
| `updatedAt` | Timestamp value. |

### `contractorProfiles/{contractorId}`

Contractor-facing profile and marketplace profile source. Contractor signup and invite acceptance write this collection.

Expected fields:

| Field | Notes |
| --- | --- |
| `id` | Contractor ID. |
| `userId` | Contractor Auth user ID. |
| `email` | Lowercase contractor email. |
| `businessName` | Test business display name. |
| `contactName` | Test contact name. |
| `phone` | Test phone or empty string. |
| `serviceCategories` | Array of test categories. |
| `serviceAreas` | Array of test areas. |
| `bio` | Test bio or empty string. |
| `isActive` | `true` for active tests. |
| `invitedByLandlordIds` | Array of associated landlord IDs. |
| `metadata.landlordNetworkIds` | Optional landlord network scopes used by marketplace routes. |
| `metadata.createdByLandlordId` | Optional creating landlord scope. |
| `createdAtMs` | Millisecond timestamp. |
| `updatedAtMs` | Millisecond timestamp. |

## Role Linking Rules

### Landlord

Landlord linking is UID-centric:

- Firebase Auth UID is the app user ID.
- `users/{uid}.role` is `landlord`.
- `users/{uid}.landlordId` is the same UID.
- `accounts/{uid}` exists for account/plan context.
- `landlords/{uid}` exists for landlord profile and plan context.
- Application JWT contains `sub=uid`, `role=landlord`, and `landlordId=uid`.

If `landlordId` is absent from a landlord JWT, some middleware falls back to the user ID. Do not rely on that fallback for pilot setup; set `landlordId` explicitly.

### Tenant

Tenant linking is tenancy-centric:

- Tenant portal JWT contains `sub=tenantId`, `role=tenant`, `tenantId`, and usually `landlordId`.
- `tenants/{tenantId}` stores the landlord, property, unit, lease, and application associations.
- Invite redemption may derive a tenant ID from landlord/email context if an invite or application does not already provide one.
- `leases/{leaseId}` should include `tenantId`, `tenantIds`, and `primaryTenantId` for tenant matching.
- `tenancies/{tenancyId}` may link `tenantId`, `landlordId`, `propertyId`, and `unitId`.

For manual pilot setup, prefer creating a deterministic tenant document and then minting or obtaining a tenant session through the existing invite or tenant auth flow.

### Contractor

Contractor linking is contractor-ID-centric:

- Firebase Auth UID is generally the contractor ID.
- `users/{uid}.role` is `contractor`.
- `users/{uid}.contractorId` is the same UID.
- `accounts/{uid}.role` is `contractor`.
- `contractorProfiles/{uid}` stores profile and landlord invite associations.
- Work orders use `assignedContractorId` and optionally `invitedContractorIds` to grant contractor access.
- Contractor portal routes require `role=contractor` or `role=admin`, then enforce that route `:contractorId` matches `req.user.contractorId` unless admin.

Contractor JWTs currently include `role=contractor` and permission arrays. The signup/login paths may omit `contractorId` from the signed claim, but `requireContractor` falls back to the user ID. For pilot clarity, the Firestore docs should still include `contractorId`.

### Admin

Admin linking is role-centric:

- Application JWT should carry `role=admin`.
- `users/{uid}.role` should be `admin` if DB hydration is enabled or if `/api/me` must return admin role after hydration.
- Some admin access checks also allow configured admin email or subject allowlists through environment variables.
- Firestore rules treat `role=admin`, `role=support`, and `role=operator` as admin-level direct Firestore access.

For pilot accounts, prefer explicit `role=admin` in both session claims and `users/{uid}`.

## Manual Account Creation Procedure

Use a controlled preview or staging Firebase project. Do not create these accounts in production unless a release owner explicitly authorizes it.

### Step 1: Create Firebase Auth User

For each test person:

1. Open the approved Firebase project.
2. Create a Firebase Auth user with the test email.
3. Set a temporary password through the approved secure channel.
4. Mark email verified only if the test flow requires password login without email verification.
5. Keep `disabled=false`.
6. Store credentials only in the approved secure credential store.

### Step 2: Create Firestore Profile Docs

Create only the documents required for the role.

Landlord:

- `users/{landlordUserId}`
- `accounts/{landlordUserId}`
- `landlords/{landlordUserId}`

Tenant:

- `tenants/{tenantId}`
- Optional `users/{tenantUserId}` only when using DB hydration or full user profile testing.
- Related `leases`, `tenancies`, applications, and tenant invite records as needed.

Contractor:

- `users/{contractorUserId}`
- `accounts/{contractorUserId}`
- `contractorProfiles/{contractorUserId}`
- Related `workOrders` with `assignedContractorId` or `invitedContractorIds`.

Admin:

- `users/{adminUserId}`
- Optional `accounts/{adminUserId}` if testing DB hydration or account reads.

### Step 3: Create Associated Test Data

For landlord workflow:

1. Create `properties/{propertyId}` with `landlordId` set to the landlord test scope.
2. Create `units/{unitId}` with the same `landlordId`.
3. Create `leases/{leaseId}` with `landlordId`, `propertyId`, `unitId`, and tenant fields if tenant testing is required.
4. Create billing, screening, and signing records only in test mode and only if the related pilot QA requires them.

For tenant workflow:

1. Create `tenants/{tenantId}` linked to the landlord, property, unit, and lease.
2. Ensure the linked lease includes `tenantId`, `tenantIds`, and `primaryTenantId`.
3. Create `tenancies/{tenancyId}` if tenant workspace resolution needs a tenancy record.
4. Use tenant invite redemption where possible so the app normalizes applications, lease, tenant, and tenancy records consistently.

For contractor workflow:

1. Create `contractorProfiles/{contractorId}`.
2. Create or update `workOrders/{workOrderId}` with `assignedContractorId=contractorId`.
3. Include `landlordId` on the work order so landlord ownership remains enforceable.
4. Use `contractorInvites` only if testing invite acceptance.

### Step 4: Obtain Application Session

Preferred paths:

- Landlord: use `POST /api/auth/login` with the Firebase Auth email/password.
- Contractor: use contractor invite signup or login with a contractor-profiled account.
- Tenant: use tenant invite acceptance or the tenant token flow used by the tenant portal.
- Admin: use the approved admin login path or a session whose `/api/me` returns `role=admin`.

Development-only token minting routes exist, but they are guarded by environment flags and must not be used for pilot evidence unless the environment and operator explicitly allow them:

- `POST /api/dev/auth/token`
- `POST /api/dev/mint-tenant-token`

## Verification Checklist

Run these checks with safe test accounts only.

### Landlord

1. Log in as landlord.
2. Call `GET /api/me`.
3. Confirm response user has `role=landlord` and the expected `landlordId`.
4. Call a landlord route such as `GET /api/properties`.
5. Confirm only the landlord test property scope is visible.
6. Attempt a tenant-only endpoint and confirm it fails closed.

### Tenant

1. Obtain a tenant session through invite or tenant portal flow.
2. Call `GET /api/tenant/me` or a tenant workspace endpoint.
3. Confirm the session has `role=tenant` and non-empty `tenantId`.
4. Confirm tenant-visible lease, notice, payment, and document views are tenant-safe.
5. Attempt `GET /api/leases` and confirm it fails closed.
6. Attempt contractor endpoints and confirm they fail closed.

### Contractor

1. Log in as contractor.
2. Call `GET /api/me`.
3. Confirm response user has `role=contractor` and contractor context.
4. Call `GET /api/contractors/{contractorId}/work-orders`.
5. Confirm only assigned or invited test work orders are visible.
6. Call the same route with a different contractor ID and confirm it fails closed.
7. Inspect message responses for no raw landlord, tenant, lease, storage path, token, or provider payload exposure.

### Admin

1. Log in as admin.
2. Call `GET /api/me`.
3. Confirm response user has `role=admin`.
4. Call an admin route such as `GET /api/admin/overview` if available in the target environment.
5. Confirm landlord, tenant, and contractor accounts cannot access the same admin route.

## Firestore Rules Reference

Root `firebase.json` points Firestore to root `firestore.rules`.

Important direct Firestore claim checks:

- `role()` reads `request.auth.token.role`.
- `landlordClaim()` reads `request.auth.token.landlordId` or falls back to `request.auth.uid`.
- `tenantClaim()` reads `request.auth.token.tenantId` or falls back to `request.auth.uid`.
- `isLandlord()` requires `role() == "landlord"`.
- `isTenant()` requires `role() == "tenant"`.
- `isAdmin()` accepts `admin`, `support`, or `operator`.
- Contractor document access is checked mostly by `request.auth.uid` against contractor fields such as `assignedContractorId`, `invitedContractorIds`, and `contractorId`.

These rules are defense-in-depth for direct Firestore access. API middleware and route projections remain the canonical app authorization boundary.

## Disable And Delete Procedure

Disable first, delete later.

1. Disable the Firebase Auth user in the approved Firebase project.
2. Set `users/{userId}.disabled=true` where a `users` document exists.
3. Set `status=disabled` or `isActive=false` on role-specific profile documents where applicable.
4. Remove or expire active invite documents for tenant or contractor test access.
5. Do not delete seeded leases, payments, screening records, notices, work orders, or audit events unless a release owner explicitly authorizes cleanup.
6. Record cleanup in the secure operator checklist, not in repository files.

For full deletion after the retention window:

1. Confirm no audit, billing, screening, signing, or tenant evidence retention requirement applies.
2. Delete Firebase Auth user.
3. Delete or archive role-specific profile documents only if approved.
4. Preserve append-only operational history.

## Operator Safety Checks

Before releasing test accounts to pilot operators:

- Confirm the Firebase project is preview or staging, not production.
- Confirm each Auth user has exactly one intended primary role.
- Confirm `users`, `accounts`, and role-specific documents agree on role and scope.
- Confirm landlord IDs do not cross between unrelated landlord test portfolios.
- Confirm tenant documents point only to their intended landlord/property/unit/lease.
- Confirm contractor profiles and work orders point only to the intended contractor and landlord.
- Confirm `/api/me` returns expected role and scope.
- Confirm at least one forbidden cross-role endpoint returns 401 or 403 for each role.
- Confirm no raw tokens, passwords, service keys, storage paths, or provider payloads are included in handoff notes.

## Known Gaps

- No repository code path was found that sets Firebase Admin custom user claims with `setCustomUserClaims`.
- The app-issued JWT claim model and Firestore rules claim model both reference `role`, `landlordId`, and `tenantId`, but direct Firebase custom-claim assignment must be handled outside the inspected code if direct Firestore client access is required.
- Contractor claims do not have an explicit Firestore rules helper like `isContractor`; contractor document access is based on `request.auth.uid` matching contractor fields.
- `rentchain-api/src/types/auth.ts` omits `contractor` from one older `UserRole` union, while active middleware and route code support contractor.
- Several legacy and dev-only token paths exist. Use production-like login and invite flows for pilot evidence unless a controlled test explicitly requires a dev route.
