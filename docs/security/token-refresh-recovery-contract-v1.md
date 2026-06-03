# Token Refresh And Recovery Contract v1

## Scope

This contract records the current token refresh, logout, password recovery, invite recovery, and two-factor recovery-adjacent behavior for the Phase 3 hardening pass. It does not introduce new runtime endpoints, auth providers, deployment configuration, Firestore rules, Firestore indexes, or production data changes.

## Current Supported Auth Routes

`rentchain-api/src/routes/authRoutes.ts` currently mounts these auth routes:

- `POST /api/auth/signup` with auth-sensitive rate limiting and signup schema validation (`rentchain-api/src/routes/authRoutes.ts:697-972`).
- `POST /api/auth/password-reset/confirmation` with a dedicated 15-minute, 20-request rate limit and email validation (`rentchain-api/src/routes/authRoutes.ts:42-47`, `rentchain-api/src/routes/authRoutes.ts:974-1016`).
- `GET /api/auth/onboard/resolve` for invite token resolution (`rentchain-api/src/routes/authRoutes.ts:1018-1066`).
- `POST /api/auth/onboard/accept` for invite acceptance (`rentchain-api/src/routes/authRoutes.ts:1068-1532`).
- `POST /api/auth/login` with auth-sensitive rate limiting and login enablement checks (`rentchain-api/src/routes/authRoutes.ts:1534-1729`).
- `GET /api/auth/health` for login configuration health (`rentchain-api/src/routes/authRoutes.ts:1731-1756`).
- `POST /api/auth/login/demo`, disabled in production (`rentchain-api/src/routes/authRoutes.ts:1758-1803`).
- `POST /api/auth/2fa/verify` with an in-module rate limit and pending-token verification (`rentchain-api/src/routes/authRoutes.ts:1805-1881`).
- `POST /api/auth/2fa/totp/setup`, `POST /api/auth/2fa/totp/confirm`, `POST /api/auth/2fa/backup-codes/regenerate`, `POST /api/auth/2fa/disable`, and `POST /api/auth/2fa/trust-device`, each authenticated through `authenticateJwt` and rate limited (`rentchain-api/src/routes/authRoutes.ts:1883-2118`).
- `GET /api/auth/me` through `requireAuth` (`rentchain-api/src/routes/authRoutes.ts:2121-2142`).
- `POST /api/auth/logout`, which returns a success response and does not perform server-side JWT revocation (`rentchain-api/src/routes/authRoutes.ts:2144-2146`).
- `GET /api/auth/demo` for demo email metadata (`rentchain-api/src/routes/authRoutes.ts:2148-2150`).

Tenant auth has a separate login/logout route module. Tenant login verifies a stored password hash and signs a tenant JWT for seven days; tenant logout returns a local success response (`rentchain-api/src/routes/tenantAuthRoutes.ts:9-54`).

## Unsupported Refresh And Recovery Endpoints

The current auth route table does not define:

- `POST /api/auth/refresh`
- `POST /api/auth/resetPassword`
- `POST /api/auth/verifyEmail`

These routes must not silently succeed. The contract tests assert that these unsupported routes return a 404 through the mounted auth router fallback and do not return token, reset-link, or trusted-device fields.

## Token Issuance And Lifetime

The canonical JWT helper signs `JwtClaimsV1` with subject, email, role, optional landlord and tenant scope, permissions, revoked permissions, impersonation attribution fields, and version `1` (`rentchain-api/src/auth/jwt.ts:4-40`). The helper defaults to seven days unless a route supplies an override (`rentchain-api/src/auth/jwt.ts:28-36`).

Current auth route issuance points include contractor signup, landlord signup, landlord/contractor login, tenant invite acceptance, 2FA verification, trusted-device creation, demo login, and tenant auth login (`rentchain-api/src/routes/authRoutes.ts:843-870`, `rentchain-api/src/routes/authRoutes.ts:920-960`, `rentchain-api/src/routes/authRoutes.ts:1314-1333`, `rentchain-api/src/routes/authRoutes.ts:1370-1398`, `rentchain-api/src/routes/authRoutes.ts:1418-1459`, `rentchain-api/src/routes/authRoutes.ts:1624-1637`, `rentchain-api/src/routes/authRoutes.ts:1665-1687`, `rentchain-api/src/routes/authRoutes.ts:1790-1802`, `rentchain-api/src/routes/authRoutes.ts:1871-1880`, `rentchain-api/src/routes/authRoutes.ts:2106-2117`, `rentchain-api/src/routes/tenantAuthRoutes.ts:35-50`).

`requireAuth` verifies a Bearer token, hydrates the canonical session user, attaches entitlements, and fails closed for disabled account and landlord or tenant scope mismatch (`rentchain-api/src/middleware/requireAuth.ts:5-40`). `sessionUserService` can hydrate from claims or database records and rejects disabled or scope-mismatched accounts in the database-backed path (`rentchain-api/src/services/sessionUserService.ts:99-171`, `rentchain-api/src/services/sessionUserService.ts:240-270`).

## Logout Semantics

Backend logout currently returns `{ "message": "Logged out" }` and does not revoke outstanding JWTs server-side (`rentchain-api/src/routes/authRoutes.ts:2144-2146`). Frontend logout clears local token state before calling backend logout when a token exists (`rentchain-frontend/src/context/AuthContext.tsx:496-513`). The frontend API logout call posts to `/api/auth/logout` and sends the current token as an Authorization header when provided (`rentchain-frontend/src/api/authApi.ts:256-261`).

This contract records logout as client-token clearing plus backend acknowledgement. It does not claim full server-side revocation. See `docs/security/logout-session-revocation-contract-v1.md` for the detailed logout, concurrent-session, trusted-device, and revocation-boundary contract.

## Password Recovery Contract

`POST /api/auth/password-reset/confirmation` is a post-change notification route. It validates email format, requires configured sender metadata, sends a confirmation email, logs masked email only, and returns 204 on success (`rentchain-api/src/routes/authRoutes.ts:974-1016`). It is not a reset-token issuance endpoint.

The current frontend auth API does not call `/api/auth/refresh`, `/api/auth/resetPassword`, or `/api/auth/verifyEmail` (`rentchain-frontend/src/api/authApi.ts:59-265`).

## Invite Recovery Contract

Onboarding token resolution checks contractor, tenant, and landlord invite sources, uses hashed token lookup for landlord invites, reports expired or already accepted states, and returns redacted copy and masked email metadata where applicable (`rentchain-api/src/routes/authRoutes.ts:321-594`, `rentchain-api/src/routes/authRoutes.ts:1018-1066`).

Onboarding acceptance checks invalid, expired, already accepted, signup-required, login-required, wrong-account, exact-email, and tenant invite states before issuing tenant or contractor session responses (`rentchain-api/src/routes/authRoutes.ts:1068-1532`). Existing tenant invite tests cover hashed tenancy invite resolution/acceptance, converted tenant linking, tenant ID precedence, occupancy safety, active lease occupancy sync, and replaced-token expiry (`rentchain-api/src/routes/__tests__/authOnboardTenantInvites.test.ts:119-430`).

## Two-Factor Recovery-Adjacent Contract

`POST /api/auth/2fa/verify` requires `pendingToken`, `method`, and `code`; invalid or expired pending tokens fail with 401 and do not issue a session token (`rentchain-api/src/routes/authRoutes.ts:1805-1881`). TOTP setup, confirmation, backup-code regeneration, disablement, and trusted-device creation require authenticated context and rate limiting (`rentchain-api/src/routes/authRoutes.ts:1883-2118`).

Setup and confirmation currently expose TOTP setup materials and backup codes only in the intended setup/confirmation response contract (`rentchain-api/src/routes/authRoutes.ts:1903-1910`, `rentchain-api/src/routes/authRoutes.ts:1951-1962`). Trusted-device creation returns a trusted-device token only after authenticated 2FA validation (`rentchain-api/src/routes/authRoutes.ts:2063-2118`).

## Frontend Contract

Frontend auth API calls login, signup, demo login, 2FA verify/setup/confirm/regenerate/trust/disable, `/me`, restore-session fallback `/auth/me`, and logout (`rentchain-frontend/src/api/authApi.ts:59-265`). Frontend token storage separates main auth token handling from tenant token storage (`rentchain-frontend/src/lib/authToken.ts:3-113`). `AuthContext` validates token shape and expiry, restores sessions through `/api/me`, stores login/signup/2FA tokens, and clears local state on logout (`rentchain-frontend/src/context/AuthContext.tsx:65-164`, `rentchain-frontend/src/context/AuthContext.tsx:189-210`, `rentchain-frontend/src/context/AuthContext.tsx:212-339`, `rentchain-frontend/src/context/AuthContext.tsx:341-513`).

No frontend source change is required for unsupported refresh/reset/verify endpoints because the audited frontend auth API does not call those endpoints.
