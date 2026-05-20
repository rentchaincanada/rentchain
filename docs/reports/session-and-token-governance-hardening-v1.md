# Session and Token Governance Hardening v1

## Executive Summary

This mission audits and hardens RentChain session/token handling without rewriting authentication. The current system uses Firebase Auth token fallback for landlord/admin API calls, legacy RentChain bearer tokens for existing landlord flows, tenant bearer tokens for tenant workspace routes, server-side JWT validation for protected backend routes, and explicit webhook/internal-token flows for provider/server operations.

The implementation remains conservative:

- no Firebase Auth architecture changes
- no JWT format changes
- no Firestore rule changes
- no route visibility changes
- no role or permission changes
- no token lifetime changes
- no login/logout UX rewrite

The runtime changes are limited to safer log redaction and debug-token display suppression.

## Current Auth Model Summary

Frontend landlord/admin requests use a layered token model:

- Firebase ID tokens are obtained through `getFirebaseIdToken()` when a Firebase user is available.
- Stored RentChain bearer tokens are read through `getAuthToken()` for legacy/auth-route compatibility.
- API clients set `Authorization: Bearer <token>` and `x-rc-auth` metadata when a token is present.
- Missing-token diagnostics log only route/path/auth-source metadata, not token values.

Tenant workspace requests use tenant bearer tokens:

- tenant tokens are stored under `rentchain_tenant_token`
- tenant API clients prefer tenant tokens for `/api/tenant/*`
- tenant logout clears tenant token storage and invite/session markers

Backend validation uses two current patterns:

- `authenticateJwt` optionally hydrates `req.user` when a bearer token is present and leaves auth enforcement to route-level middleware for most routes.
- `requireAuth` is strict and rejects missing/invalid bearer tokens before hydrating canonical session users.

The shared request authority resolver remains the server-side source for effective landlord/tenant/admin authority semantics after auth has populated `req.user`.

## Frontend Session Storage Observations

Observed client-side session state:

- `rentchain_token` can exist in `sessionStorage`, `localStorage`, and memory for landlord/admin compatibility.
- legacy keys `rc_auth_token`, `authToken`, and `token` are migrated into `rentchain_token` and removed.
- `rentchain_tenant_token` can exist in tenant session/local storage for tenant workspace compatibility.
- `authJustLoggedInAt` is a non-secret timing marker used for short login grace handling.
- `debugAuthEnabled` enables debug diagnostics.

Minimal hardening added:

- debug auth overlays now show only token presence and length with `[redacted]`.
- token prefixes/suffixes are not displayed in debug UI.

## Backend Token Validation Flow

Observed backend validation:

- `requireAuth` rejects missing tokens with `401 unauthenticated`.
- `requireAuth` verifies JWT claims through `verifyAuthToken()`.
- `requireAuth` hydrates a canonical session user through `buildCanonicalSessionUserFromClaims()`.
- `authenticateJwt` allows public auth routes, health, CORS preflight, existing dev bypass paths, and optional event tracking.
- `authenticateJwt` rejects malformed/invalid bearer tokens outside optional-auth paths.
- Optional auth for `/api/events/track` remains intentionally permissive.

Minimal hardening added:

- invalid-token logging in `authenticateJwt` now uses `safeErrorLog()` instead of direct `console.error`.
- the log preserves route, method, and auth-header presence while suppressing token/error secret content.

## Optional Auth vs Required Auth

Optional-auth routes:

- may accept missing or invalid tokens without failing the request
- must not infer privileged access from client-provided identity
- should log only safe route/status metadata

Required-auth routes:

- must fail closed on missing or invalid bearer tokens
- must hydrate server-side authority context from verified claims
- must not rely on frontend role assumptions

The existing optional-auth route explicitly identified during this audit is `/api/events/track`.

## Logout and Session Invalidation Expectations

Landlord/admin logout:

- clears local, session, and in-memory `rentchain_token`
- removes legacy token keys
- removes login grace markers
- notifies `/api/auth/logout` when a token was present

Tenant logout:

- clears tenant token storage
- clears tenant invite/session markers
- redirects to tenant login

Known limitation:

- backend logout is currently acknowledgement-style. It does not revoke already-issued JWTs server-side. Future revocation/session registry work should be handled as a separate auth architecture mission.

## Internal Token Handling Expectations

Internal/webhook/provider tokens must remain server-only:

- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `INTERNAL_JOB_TOKEN`
- provider API keys
- webhook signatures/secrets

Frontend `VITE_*` variables are client-exposed by design. They must not contain server-only secrets. This audit found an existing local development env file containing development-only frontend values; no production env or infrastructure settings were changed in this mission.

## Impersonation and Support Access Notes

Current authority semantics include awareness of:

- `actorRole`
- `actorLandlordId`
- admin role checks
- support/admin route families

This mission does not add impersonation or support access behavior. Future admin/support governance should build on the request authority resolver and require explicit audit/event semantics.

## Token Redaction Hardening

The shared logger now treats these additional key families as restricted:

- `authorization` / `Authorization`
- `bearer`
- `idToken`
- `refreshToken`
- `accessToken`
- `firebaseToken`
- `sessionToken`
- `customToken`
- `internalJobToken`
- `cookie`
- `set-cookie`

Existing inline secret redaction continues to suppress bearer strings, JWT-looking strings, Stripe secrets, webhook secrets, and token/query-secret patterns.

## Known Limitations

- Multiple frontend API clients still exist and should be consolidated in a future mission.
- Legacy bearer-token storage remains for compatibility.
- Firebase Auth token refresh and persistence behavior are owned by Firebase SDK configuration.
- Backend logout does not implement server-side token revocation.
- Optional-auth route semantics are documented but not centralized in a route registry yet.
- Debug auth remains available behind explicit debug flags, but now avoids displaying token material.

## Future Hardening

Recommended follow-up missions:

1. `fix/api-auth-client-consolidation-v1`
2. `fix/server-side-token-revocation-and-session-registry-v1`
3. `fix/admin-support-access-governance-v1`
4. `test/optional-auth-route-governance-regression-v1`
5. `fix/frontend-env-secret-exposure-audit-v1`

## Verification Expectations

Required local verification for this mission:

- safe logger tests
- auth middleware tests
- auth debug overlay tests
- backend build
- frontend build

Preview QA after deployment:

1. Load `/login`
2. Log in successfully
3. Open `/dashboard`
4. Open `/operations`
5. Log out
6. Confirm unauthenticated/login state
7. Confirm no token or `Authorization` values appear in console logs
8. Confirm no CSP/security header regressions
