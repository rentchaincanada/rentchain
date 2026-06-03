# Environment Separation Policy v1

## Purpose

This policy defines required governance controls for keeping RentChain production, preview, development, and test environments separated. It applies to frontend deployment settings, Cloud Run backend runtime configuration, Firestore access, Firebase Auth configuration, CI/CD, local development, and incident response.

## Policy Baseline

- Production data is protected by backend authorization, Cloud Run runtime identity, Firebase/Firestore access controls, and environment validation.
- Preview deployments must be treated as production-adjacent when they route to the production backend.
- Development and test environments must use Firestore emulator configuration by default.
- Environment secrets must remain outside committed files and outside public documentation.
- New environment connections require explicit review before deployment.

## Control Matrix

| Control Area | Required Control | Evidence Source |
| --- | --- | --- |
| Frontend API routing | API base must be explicit and absolute | `rentchain-frontend/src/api/baseUrl.ts` |
| Vercel rewrites | Production and preview routing must be reviewed before deploy | `rentchain-frontend/vercel.json` |
| Backend Firestore startup | Non-production startup must use emulator or approved override | `rentchain-api/src/config/firestoreEnvironmentGuard.ts` |
| Firebase Admin initialization | Guard must run before Admin SDK initialization | `rentchain-api/src/firebase/admin.ts` |
| Backend env validation | Production missing hard env values must fail startup | `rentchain-api/src/config/requiredEnv.ts` |
| CI | Frontend CI must not require production API secrets | `.github/workflows/ci.yml` |
| Local env | Local template must use fake placeholders and emulator defaults | `rentchain-api/.env.example` |

## Approval Requirements

Any of the following require a dedicated review before merge:

- Adding a preview backend service.
- Changing Vercel rewrites or CSP `connect-src`.
- Adding or changing `VITE_API_BASE_URL` behavior.
- Adding a backend secret or credential variable.
- Changing Firestore emulator guard behavior.
- Changing Cloud Run deployment settings.
- Changing Firestore rules, indexes, or database assignment.
- Adding Firebase Auth project separation or token issuer changes.

## Compliance Checklist

Before approving environment-related changes:

1. Confirm the change does not expose secrets or credential identifiers.
2. Confirm production routes do not point at preview services.
3. Confirm preview services cannot mutate production data unless explicitly authorized and protected by production auth.
4. Confirm local and test startup continue to use the emulator by default.
5. Confirm frontend build values are scoped to the correct Vercel environment.
6. Confirm no user-facing docs expose infrastructure internals.
7. Confirm rollback steps exist for misrouting or wrong-database incidents.

## Enforcement Points

- Backend startup guard blocks unsafe non-production Firestore initialization.
- Backend production startup fails when hard-required env values are missing.
- Frontend API base validation requires absolute URLs and logs production misconfiguration.
- Vercel CSP limits allowed connection origins to committed allowlist patterns.
- CI validates build compatibility without injecting production credential values.

## Exceptions

The only documented local exception is `ALLOW_LOCAL_PROD_FIRESTORE=true`, and it is allowed only for explicit operator-approved diagnostics. It must not be used as a normal development or test setting and must not be committed enabled in templates.

## Review Cadence

- Review Vercel environment variables after any frontend deployment setting change.
- Review Cloud Run runtime variables and runtime identity after any backend deploy pipeline change.
- Review Firestore database assignment after any Firebase/Admin SDK initialization change.
- Review this policy after any environment separation incident.
