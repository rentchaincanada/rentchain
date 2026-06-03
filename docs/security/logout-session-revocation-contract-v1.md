# Logout Session Revocation Contract v1

## Scope

This contract records the current logout, session expiration, trusted-device, and session revocation posture for Phase 3 auth hardening. It does not introduce new runtime endpoints, new auth providers, server-side JWT revocation, Firestore rule changes, Firestore indexes, deployment configuration, dependencies, or production data changes.

The current model is stateless for issued JWTs. Logout is client-side token clearing plus backend acknowledgement. Backend logout does not revoke outstanding JWTs, does not invalidate concurrent sessions, and does not clear trusted-device tokens server-side.

## Current Supported Logout Routes

`POST /api/auth/logout` is mounted from `rentchain-api/src/routes/authRoutes.ts` before global auth decoding (`rentchain-api/src/app.build.ts:370-382`). The route does not require `requireAuth`, does not inspect the Authorization header, and returns status 200 with `{ "message": "Logged out" }` (`rentchain-api/src/routes/authRoutes.ts:2144-2146`).

`rentchain-api/src/routes/tenantAuthRoutes.ts` defines `POST /logout`, which returns status 200 with `{ "ok": true }` (`rentchain-api/src/routes/tenantAuthRoutes.ts:52-54`). The current `app.build.ts` route audit did not find this module mounted as `/api/tenant-auth/logout`; this document records the route module contract and does not change runtime mounting.

Neither logout handler returns raw tokens, session identifiers, revocation metadata, storage paths, or provider payloads.

## Logout Semantics

Backend logout is an acknowledgement endpoint. For landlord, contractor, and admin-style auth, it succeeds with or without a Bearer token. Invalid and expired Bearer tokens also receive the same success acknowledgement because the route does not verify token state.

Frontend logout records the practical session-ending behavior. `AuthContext.logout` reads the current stored token, clears browser token storage and in-memory auth state, resets 2FA pending state, and then calls the backend logout endpoint only when a token was present (`rentchain-frontend/src/context/AuthContext.tsx:496-513`). If the backend notification fails, frontend state remains cleared and the error is logged (`rentchain-frontend/src/context/AuthContext.tsx:506-512`).

`authApi.logout` posts to `/api/auth/logout` and sends the current token in the Authorization header when one is supplied (`rentchain-frontend/src/api/authApi.ts:256-261`). The API call does not receive or process a replacement token.

## Session Expiration Versus Logout Revocation

JWT signing uses `JwtClaimsV1`, including subject, email, role, optional landlord and tenant scope, permissions, revoked permissions, impersonation attribution fields, and version `1` (`rentchain-api/src/auth/jwt.ts:4-20`). `signAuthToken` requires `JWT_SECRET` and defaults to a seven-day expiration unless a caller supplies an override (`rentchain-api/src/auth/jwt.ts:22-40`).

`requireAuth` extracts a Bearer token, verifies it with `verifyAuthToken`, hydrates the canonical session user, attaches entitlements, and fails closed for unauthenticated, disabled-account, landlord-scope-mismatch, or tenant-scope-mismatch states (`rentchain-api/src/middleware/requireAuth.ts:5-40`). Token expiration is enforced when a protected route verifies the token.

Logout and expiration are separate controls:

- Expiration is automatic and enforced during token verification on protected routes.
- Logout is an explicit client-side clearing action plus backend acknowledgement.
- Logout does not add the token to a server-side deny list.
- Logout does not shorten the token's remaining lifetime.

## Frontend Token Storage

Frontend token storage uses `rentchain_token` for the main auth token and `rentchain_tenant_token` for tenant-token storage (`rentchain-frontend/src/lib/authToken.ts:1-113`, `rentchain-frontend/src/lib/authKeys.ts:1-3`). The helper reads session and local storage, migrates legacy token keys into the current key, and removes legacy keys when clearing auth state (`rentchain-frontend/src/lib/authToken.ts:48-98`).

`AuthContext` validates basic JWT shape and expiration with a short skew before restoring a session. Missing, invalid, or expired tokens are cleared locally and the user is treated as a guest (`rentchain-frontend/src/context/AuthContext.tsx:65-164`, `rentchain-frontend/src/context/AuthContext.tsx:212-339`).

After logout, the frontend no longer sends the cleared token. If an already issued token is still available elsewhere, the backend has no revocation state that invalidates it solely because logout was called.

## Trusted-Device And 2FA Lifecycle

`POST /api/auth/2fa/verify` verifies a pending 2FA token and issues the session token after a valid code (`rentchain-api/src/routes/authRoutes.ts:1805-1881`). Pending 2FA tokens are separate from final session JWTs.

`POST /api/auth/2fa/trust-device` requires authenticated context, validates a 2FA code, and returns a trusted-device token with a 30-day expiry (`rentchain-api/src/routes/authRoutes.ts:2063-2118`). Frontend pages store this value in `localStorage` under `rentchain_trusted_device` after the trust-device response (`rentchain-frontend/src/pages/AccountSecurityPage.tsx:69-76`, `rentchain-frontend/src/pages/TwoFactorPage.tsx:43-49`).

`POST /api/auth/2fa/disable` clears the in-module 2FA fields for the loaded landlord user: enabled flag, methods, TOTP secret, and backup codes (`rentchain-api/src/routes/authRoutes.ts:2015-2060`). Frontend account security removes `rentchain_trusted_device` after a successful disable response (`rentchain-frontend/src/pages/AccountSecurityPage.tsx:85-98`). The backend disable route does not return session-revocation fields and does not revoke all outstanding JWTs.

Logout does not call 2FA disablement and does not clear trusted-device tokens server-side.

## Concurrent-Session And Multi-Device Implications

The current implementation does not store active session records. As a result:

- Logging out in one browser clears that browser's local auth state.
- Another browser or device with a valid unexpired JWT remains authenticated until the token expires or another backend guard rejects it for a different reason.
- The backend does not enumerate or revoke concurrent sessions on logout.
- Tenant and landlord token storage are separate on the frontend, and logout of one surface should not be treated as proof that every possible token has been invalidated server-side.

This is an explicit baseline, not a recommendation that server-side revocation should remain absent.

## Contract Tests

`rentchain-api/src/routes/__tests__/authRecoveryContract.test.ts` validates the logout baseline with mocked Firebase dependencies and in-memory router invocation. The tests assert:

- `POST /api/auth/logout` returns 200 with `{ "message": "Logged out" }`.
- Landlord logout succeeds with no token, invalid token, expired token, and valid token.
- A valid token still succeeds on `/api/auth/me` after logout acknowledgement, proving logout does not revoke that token server-side.
- A second valid token for another session remains usable after the first token is logged out.
- Tenant logout route module returns 200 with `{ "ok": true }` and does not return token or revocation fields.
- 2FA disablement does not return all-session or trusted-device revocation fields.

These tests do not mutate production Firestore and do not require the emulator.

## Limitations

Current logout does not revoke:

- Outstanding JWTs.
- Concurrent sessions on other browsers or devices.
- Trusted-device tokens stored outside the current frontend state.
- Pending 2FA tokens solely by calling logout.
- Tenant tokens stored separately from the main auth token unless the relevant client flow clears them.

Current logout also does not write audit records, session records, or revocation records.

## Future Revocation Considerations

If operational policy requires stronger logout semantics, future work should be a separate mission. Candidate designs include:

- A server-side JWT deny list keyed by token identifier or issued-at cutoff.
- Per-user session records with active, revoked, and expired states.
- A password-change or incident-response token version that invalidates older tokens.
- Trusted-device records with server-side revocation and device-level listing.
- Account-wide or device-specific logout endpoints with route-level authorization and audit events.

Any future revocation implementation must preserve tenant, landlord, admin, and support separation; avoid raw token storage; use hashed token identifiers where identifiers are needed; and include append-safe audit records for security-sensitive revocation events.
