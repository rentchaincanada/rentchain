# Tenant Environment Audit

Source branch: docs/phase-f-tenant-portal-environment-v1

Audited source files:
- /Users/rentchain/dev/rentchain/rentchain-api/src/config/firestoreEnvironmentGuard.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/index.build.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/config/requiredEnv.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/vercel.json
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/baseUrl.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/config/apiBase.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/firebase.ts
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/tenantAuth.ts
- /Users/rentchain/dev/rentchain/.github/workflows/ci.yml
- /Users/rentchain/dev/rentchain/firestore.rules
- /Users/rentchain/dev/rentchain/docs/environment/preview-staging-separation-strategy-v1.md

## Environment Model

| Environment | Frontend | Backend | Firestore | Tenant continuity boundary |
| --- | --- | --- | --- | --- |
| Production | Vercel production domain | Production Cloud Run service | Production Firestore through backend runtime identity | Normal auth, route authorization, tenant-safe projections. |
| Preview | Vercel preview deployment | Current committed rewrites route /api and /health to production Cloud Run host | Same backend data plane reached by preview unless platform env overrides change routing | Treat preview as production-adjacent for tenant QA. |
| Development | Local Vite dev server | Local backend | Firestore emulator required by guard unless explicit override is set | Tenant tokens and local API base must point to local backend/emulator flow. |
| Test/CI | GitHub Actions frontend jobs | Backend build/test jobs | Emulator-oriented local/test model | CI sets VITE_API_BASE_URL to http://localhost:3000 for frontend tests. |

## Frontend Routing And Security Headers

/Users/rentchain/dev/rentchain/rentchain-frontend/vercel.json currently:

- Rewrites /health to the production Cloud Run health endpoint.
- Rewrites /api/:path* to the production Cloud Run /api path.
- Rewrites other paths to /index.html.
- Sets no-store cache headers for non-asset paths.
- Allows connect-src for the production Cloud Run host, *.a.run.app, RentChain domains, Google APIs, Firebase domains, Google static resources, Stripe, and Firebase websocket domains.
- Sets frame, content type, referrer, permission, HSTS, opener, and resource policy headers.

Continuity implication: Vercel preview tenant portal QA can exercise production-adjacent backend behavior unless a platform-level override changes API routing. Manual tenant QA should use seeded safe accounts and avoid creating irreversible production tenant state.

## Backend Firestore Guard

/Users/rentchain/dev/rentchain/rentchain-api/src/config/firestoreEnvironmentGuard.ts enforces:

- NODE_ENV production returns mode production.
- Non-production requires FIRESTORE_EMULATOR_HOST unless ALLOW_LOCAL_PROD_FIRESTORE=true.
- GOOGLE_APPLICATION_CREDENTIALS is prohibited outside production unless ALLOW_LOCAL_PROD_FIRESTORE=true.
- ALLOW_LOCAL_PROD_FIRESTORE=true is a diagnostic override and emits a warning.

## Firestore Rules

/Users/rentchain/dev/rentchain/firestore.rules currently documents local emulator intent and allows read/write for all documents. The file states it is not intended for production deployment and production Firestore rules require separate review.

Continuity implication: Phase H must harden production Firestore rules separately. Tenant portal safety in the current source relies on backend route authorization and projections, not these local emulator rules.

## Tenant Auth And API Base

Tenant token handling in /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/tenantAuth.ts:

- Token storage key: rentchain_tenant_token.
- getTenantToken reads localStorage first, then sessionStorage.
- Invalid non-JWT shape is rejected.
- Expired JWTs are rejected client-side.
- A valid sessionStorage token is promoted into localStorage.
- setTenantToken writes sessionStorage and localStorage when available.
- clearTenantToken removes both sessionStorage and localStorage token values.

API base handling:

- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/baseUrl.ts requires VITE_API_BASE_URL to be absolute and strips a trailing /api.
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/config/apiBase.ts derives API_BASE from VITE_API_BASE_URL or legacy VITE_API_BASE and appends /api.
- /Users/rentchain/dev/rentchain/rentchain-frontend/src/api/tenantApiFetch.ts normalizes tenant paths under /api and attaches Authorization: Bearer <tenant token> when getTenantToken returns a token.

Firebase public config values used by /Users/rentchain/dev/rentchain/rentchain-frontend/src/lib/firebase.ts:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_MEASUREMENT_ID

Tenant operational env names observed in audited source:

- JWT_SECRET and JWT_EXPIRES_IN through backend auth config usage.
- PUBLIC_APP_URL and VITE_PUBLIC_APP_URL for tenant notice, communications, invite, share, and signing URLs.
- FRONTEND_URL and FRONTEND_ORIGIN for checkout/redirect safety in payment-related services.
- SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM, SENDGRID_REPLY_TO, SENDGRID_REPLYTO_EMAIL, EMAIL_FROM, FROM_EMAIL for tenant notices and communications.
- STRIPE-related values are used by billing/payment paths outside this docs-only mission and must not be modified by Phase F.

## CI Controls

/Users/rentchain/dev/rentchain/.github/workflows/ci.yml sets VITE_API_BASE_URL to http://localhost:3000 for frontend test/build jobs. Backend and frontend checks run in CI, but preview freshness still depends on the deployed backend target because Vercel preview rewrites to Cloud Run.

## Environment Risks For Phase G/H/I

- Preview can reach production Cloud Run through committed rewrites, so preview tenant QA must be treated as production-adjacent.
- Local and test Firestore safety depends on using emulator scripts or setting FIRESTORE_EMULATOR_HOST.
- Tenant token persistence across localStorage and sessionStorage improves cross-tab continuity but increases the need for explicit logout and expired-token handling.
- Production Firestore rules hardening remains Phase H work; do not infer current firestore.rules is production-safe.
