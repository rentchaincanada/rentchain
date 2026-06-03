# Frontend Environment Variable Routing v1

## Scope

This document records current frontend/Vercel environment routing behavior and governance requirements. It does not modify Vercel configuration, frontend source, CSP, or environment variables.

## Current API Routing

Frontend source uses `VITE_API_BASE_URL` for API clients. `rentchain-frontend/src/api/baseUrl.ts` requires the value to be absolute and strips trailing `/api`. In production, missing or invalid values result in an empty base and logged error.

Committed Vercel routing in `rentchain-frontend/vercel.json` also rewrites:

- `/health` to the production Cloud Run backend host.
- `/api/:path*` to the production Cloud Run backend host.

This means Vercel preview deployments must be treated as production-adjacent unless Vercel environment behavior or deployment settings explicitly route them elsewhere.

## Current CSP

`connect-src` currently allows:

- the production Cloud Run backend host
- `*.a.run.app`
- RentChain domains
- Google APIs
- Firebase domains
- Stripe
- Firebase websocket endpoints

Any change to backend routing must review CSP at the same time.

## Frontend Public Variables

| Variable | Purpose | Required Review |
| --- | --- | --- |
| `VITE_API_BASE_URL` | API base URL | Must match deployment environment |
| `VITE_FIREBASE_API_KEY` | Firebase public config | Must match intended Auth project |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Must match deployed frontend host expectations |
| `VITE_FIREBASE_PROJECT_ID` | Firebase public project config | Must not be confused with private credentials |
| `VITE_FIREBASE_APP_ID` | Firebase app config | Environment-scoped |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage config | Environment-scoped |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging config | Environment-scoped |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase analytics config | Environment-scoped |
| `VITE_TELEMETRY_ENABLED` | Telemetry toggle | Environment-scoped |
| `VITE_TENANT_PORTAL_ENABLED` | Tenant portal feature flag | Environment-scoped |
| `VITE_DEV_PASSWORD` | Dev-only UI gate | Must not be used as production security |

## Vercel Review Checklist

Before approving preview or production frontend deployment settings:

1. Confirm `VITE_API_BASE_URL` points to the intended backend.
2. Confirm Vercel rewrites do not silently override intended API routing.
3. Confirm CSP `connect-src` allows only approved origins.
4. Confirm Firebase public config values match the intended environment.
5. Confirm no private secrets are stored as `VITE_*` values.
6. Confirm preview deployments do not mutate production data except under approved QA.
7. Confirm browser DevTools network requests hit expected API host.

## Detection

Use these checks to detect wrong-environment routing:

- Open browser DevTools Network tab and inspect `/api` requests.
- Compare API host to expected environment.
- Check Cloud Run request logs during preview QA.
- Check Vercel deployment environment variables for preview vs production.
- Review frontend console warnings from API base validation and Firebase domain mismatch logic.

## Known Gaps

- No committed frontend `.env.example` file exists.
- Current committed Vercel rewrites point API traffic at the production backend host.
- Vercel project settings are not inspectable from source and require authorized console review.
