# Preview/Staging Separation Strategy v1

## Scope

This strategy documents current RentChain production, preview, development, and test separation controls. It is documentation-only: no deployment configuration, Firestore rules, indexes, routes, services, credentials, or environment variable semantics are changed by this document.

The production API host currently referenced by frontend routing is `https://rentchain-landlord-api-915921057662.us-central1.run.app`. That value is already present in committed frontend deployment configuration and is recorded here only to describe current routing. Do not add service account emails, credential files, raw Firestore database paths, or secret values to this document.

## Current Environment Model

| Environment | Frontend | Backend | Firestore | Auth | Primary Controls |
| --- | --- | --- | --- | --- | --- |
| Production | Vercel production domain | Cloud Run production service | Production Firestore project/database | Firebase Auth public config plus backend JWT | Cloud Run runtime identity, production env validation, route authorization |
| Preview | Vercel preview deployments | Current rewrites route API traffic to the production Cloud Run host | Same backend reached by the preview frontend unless Vercel env overrides are changed | Same frontend Firebase public config model unless preview env overrides are configured | Vercel environment scoping, CSP, backend authorization, operator review |
| Development | Local Vite dev server | Local backend dev script | Firestore emulator by default | Local Firebase public config if configured | `FIRESTORE_EMULATOR_HOST`, `ALLOW_LOCAL_PROD_FIRESTORE=false`, local env template |
| Test/CI | GitHub Actions frontend test/build | Backend build only in CI | Backend tests use emulator scripts when run locally | Test stubs and local API base | CI env sets `VITE_API_BASE_URL=http://localhost:3000` for frontend jobs |

## Request Flow

```text
Production browser
  -> Vercel production frontend
  -> /api and /health rewrites
  -> production Cloud Run backend
  -> Firebase Admin / Firestore through production runtime identity

Vercel preview browser
  -> Vercel preview frontend
  -> current /api and /health rewrites
  -> production Cloud Run backend unless preview-specific env/routing is introduced
  -> backend authorization and Firestore controls

Local browser
  -> Vite dev server
  -> VITE_API_BASE_URL
  -> local backend
  -> Firestore emulator when backend uses approved dev/test scripts
```

## Current Separation Findings

- `rentchain-frontend/vercel.json` rewrites `/api/:path*` and `/health` to the production Cloud Run host.
- `rentchain-frontend/vercel.json` CSP `connect-src` allows the production Cloud Run host, `*.a.run.app`, RentChain domains, Firebase domains, Google APIs, and Stripe.
- `rentchain-frontend/src/api/baseUrl.ts` requires an absolute `VITE_API_BASE_URL`; production logs an error and returns an empty base when missing or invalid.
- `rentchain-api/src/config/firestoreEnvironmentGuard.ts` requires the Firestore emulator for local/development/test startup unless an explicit diagnostic override is enabled.
- `rentchain-api/src/firebase/admin.ts` calls the Firestore guard before Firebase Admin initialization.
- `.github/workflows/ci.yml` builds backend and runs frontend tests/build with local API base values, not production secrets.
- `rentchain-api/cloudbuild.yaml` deploys the production Cloud Run service and does not define a separate preview backend service.
- `rentchain-frontend/.env.example` is not present in the current tree; frontend env documentation currently lives in `rentchain-frontend/README.md` and code.

## Separation Requirements

Production must never depend on preview credentials, preview databases, or preview API hosts. Preview must never receive production secrets or mutate production data unless the preview is intentionally routed through production and protected by normal production authorization. Development and tests must use the Firestore emulator unless an operator explicitly approves a diagnostic override.

## Governance Controls

- Keep production and preview Vercel environment variables separate in Vercel settings.
- Treat any preview deployment that routes to production Cloud Run as production-adjacent for access-control purposes.
- Require an explicit review before introducing a preview Cloud Run service, preview Firebase project, or preview Firestore database.
- Require `git diff --check` and sensitive-value scans for all environment documentation changes.
- Do not document raw secret values, service account emails, or Firestore database paths in repository docs.

## Known Gaps

- No dedicated preview Cloud Run service is documented in committed configuration.
- Vercel preview routing currently appears capable of reaching the production backend through committed rewrites unless environment-specific Vercel settings override usage patterns.
- Frontend has no committed `.env.example` template.
- Production service account IAM bindings and Secret Manager policies were not inspectable from source and must be verified in the cloud console by an authorized operator.

## Related Documents

- `docs/governance/environment-separation-policy-v1.md`
- `docs/security/secret-credential-management-v1.md`
- `docs/governance/environment-variable-governance-v1.md`
- `docs/security/cloud-run-separation-enforcement-v1.md`
- `docs/security/firestore-separation-governance-v1.md`
- `docs/security/authentication-token-separation-v1.md`
- `docs/deployment/frontend-environment-variable-routing-v1.md`
- `docs/security/environment-separation-testing-strategy-v1.md`
- `docs/security/environment-separation-operational-dashboard-v1.md`
- `docs/runbooks/environment-separation-incident-response-v1.md`
- `docs/governance/firestore-index-governance-v1.md`
