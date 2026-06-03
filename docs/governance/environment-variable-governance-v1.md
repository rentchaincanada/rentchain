# Environment Variable Governance v1

## Scope

This document catalogs committed backend and frontend environment variable usage and establishes approval rules for additions. It does not change variable semantics.

## Backend Variables

| Variable | Current Role | Scope Classification | Validation Source |
| --- | --- | --- | --- |
| `NODE_ENV` | Runtime mode | environment-specific | `requiredEnv.ts`, `firestoreEnvironmentGuard.ts` |
| `APP_BASE_URL` | Application URL option | environment-specific | required one-of group |
| `FRONTEND_URL` | Frontend URL option | environment-specific | required one-of group |
| `PUBLIC_APP_URL` | Public app URL option | environment-specific | required one-of group |
| `JWT_SECRET` | Auth signing | secret, environment-specific | hard required |
| `STRIPE_SECRET_KEY` | Stripe server credential | secret, environment-specific | hard required |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook credential | secret, environment-specific | hard required |
| `INTERNAL_JOB_TOKEN` | Internal route token | secret, environment-specific | hard required |
| `FIREBASE_API_KEY` | Firebase config value | environment-specific | hard required |
| `STRIPE_PRICE_STARTER_MONTHLY_LIVE` | Pricing config | environment-specific | hard required |
| `STRIPE_PRICE_PRO_MONTHLY_LIVE` | Pricing config | environment-specific | hard required |
| `STRIPE_PRICE_ELITE_MONTHLY_LIVE` | Pricing config option | environment-specific | one-of group |
| `STRIPE_PRICE_BUSINESS_MONTHLY_LIVE` | Pricing config option | environment-specific | one-of group |
| `EMAIL_PROVIDER` | Email provider selector | environment-specific | provider requirements |
| `MAILGUN_API_KEY` | Mailgun credential | secret, environment-specific | hard required when Mailgun |
| `MAILGUN_DOMAIN` | Mailgun routing | environment-specific | hard required when Mailgun |
| `EMAIL_FROM` | Sender address | environment-specific | hard required when Mailgun |
| `SENDGRID_API_KEY` | SendGrid credential | secret, environment-specific | hard required when SendGrid |
| `SENDGRID_FROM_EMAIL` | Sender address | environment-specific | hard required when SendGrid |
| `EMAIL_REPLY_TO` | Reply-to address | environment-specific | soft requirement |
| `MAINTENANCE_NOTIFY_EMAIL` | Notification recipient | environment-specific | soft requirement |
| `VERIFIED_SCREENING_NOTIFY_EMAIL` | Notification recipient | environment-specific | soft requirement |
| `ADMIN_EMAILS` | Admin allowlist | secret-adjacent, environment-specific | soft requirement |
| `AUTH_BOOTSTRAP_TOKEN` | Bootstrap credential | secret, environment-specific | soft requirement |
| `AUTH_LOGIN_ENABLED` | Auth feature flag | environment-specific | soft requirement |
| `PASSWORD_LOGIN_ENABLED` | Auth feature flag | environment-specific | soft requirement |
| `FIRESTORE_EMULATOR_HOST` | Local/test Firestore target | development/test-only | guard enforced |
| `ALLOW_LOCAL_PROD_FIRESTORE` | Diagnostic override | restricted exception | guard enforced |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local credential path | production/diagnostic only | prohibited locally without override |

## Frontend Variables

| Variable | Current Role | Scope Classification | Evidence |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | API host for frontend requests | environment-specific | `src/api/baseUrl.ts`, README |
| `VITE_FIREBASE_API_KEY` | Firebase public client config | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth public domain | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase public project identifier | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_FIREBASE_APP_ID` | Firebase public app identifier | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase public storage config | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase public messaging config | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase public analytics config | environment-specific public config | `src/lib/firebase.ts` |
| `VITE_TELEMETRY_ENABLED` | Client telemetry toggle | environment-specific | README, telemetry helper |
| `VITE_TENANT_PORTAL_ENABLED` | Tenant portal UI flag | environment-specific | frontend route code |
| `VITE_DEV_PASSWORD` | Development-only UI gate | development-only | dev component |
| `VITE_BUREAU_PROVIDER` | Bureau provider selector | environment-specific | bureau adapter |
| `VITE_BUILD_ID` | Build identifier | generated per build | frontend build script |
| `VITE_SUPPORT_EMAIL` | Support email display | environment-specific public config | maintenance page |

## Addition Requirements

Every new environment variable must include:

- Name and owner.
- Backend/frontend classification.
- Secret/public classification.
- Allowed environments.
- Example fake value if a template entry is needed.
- Validation or failure behavior.
- Link to affected runtime file.
- Review of whether production and preview values must differ.

## Drift Detection

Use this review after any environment variable change:

1. Compare backend required env list to backend `.env.example`.
2. Compare frontend `VITE_*` usage to Vercel project settings and docs.
3. Verify CI still uses local or test-safe values.
4. Confirm no production-only values are required for local test/build.
5. Confirm no preview value points at a production backend unless explicitly approved.

## Known Gaps

- `rentchain-frontend/.env.example` is absent in the current repository.
- Vercel environment values are not committed and require authorized console review.
- Some frontend public Firebase values are required by runtime code but cannot be verified from source alone.
