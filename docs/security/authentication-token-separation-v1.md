# Authentication Token Separation v1

## Scope

This document records current authentication/token separation boundaries for production, preview, development, and test. It does not implement token revocation, auth project migration, route changes, or frontend changes.

## Current Token Model

- Backend JWTs are signed and verified with `JWT_SECRET`.
- JWT claims include subject, email, role, landlord scope, tenant scope, permissions, revocations, and version.
- `requireAuth` verifies the token and hydrates canonical session context.
- Scope mismatches fail closed for landlord and tenant contexts.
- Frontend can use stored backend bearer tokens or Firebase ID tokens depending on path and auth state.
- Frontend Firebase public config is read from `VITE_FIREBASE_*` values.

## Separation Requirements

Production tokens must not grant access to preview-only resources, and preview tokens must not grant access to production resources unless preview is intentionally routed through the production backend and the user is authorized under production rules.

## Current Findings

- Source does not show separate committed Firebase Auth projects for preview and production.
- Vercel preview routing currently appears production-adjacent because `/api` rewrites target the production backend host.
- Backend route authorization remains the primary data boundary.
- Logout remains acknowledgement-oriented and does not provide server-side JWT revocation.
- Firebase Auth public config values are not committed, so environment-specific Auth project separation must be verified in Vercel/Firebase settings by an authorized operator.

## Token Validation Checklist

For production and preview:

1. Confirm `JWT_SECRET` is environment-scoped and not shared with local development.
2. Confirm Firebase Auth public config points to the intended environment.
3. Confirm backend `/api/me` or equivalent session hydration returns expected role and scope.
4. Confirm tenant tokens cannot access landlord/admin routes.
5. Confirm landlord tokens cannot access unrelated landlord or tenant data.
6. Confirm admin/support tokens require explicit permissions for privileged surfaces.
7. Confirm preview login users cannot access production tenant data unless preview is intentionally production-routed and the access is approved.

## Incident Response

If cross-environment token access is suspected:

1. Stop affected preview or production deployment traffic where possible.
2. Capture token issuer, audience, route, role, landlord scope, and tenant scope metadata without logging raw tokens.
3. Rotate affected auth secrets if signing boundary exposure is possible.
4. Disable affected accounts if account compromise is suspected.
5. Review route authorization and session hydration logs.
6. Document affected data surfaces.
7. Add tests or operational checks for the failed boundary.

## Future Separation Options

Future missions may evaluate:

- Separate Firebase Auth projects for preview and production.
- Environment claim requirements in JWTs.
- Server-side token version or deny-list revocation.
- Preview-only user namespaces.
- Automated checks that reject tokens from unexpected issuers.

These options are not implemented by this documentation mission.
