# Local Environment Template Audit v1

## Scope

This audit covers local backend startup environment templates and the validation paths that emit startup environment warnings.

Reviewed files:

- `.env.example`
- `.env.example.pilot`
- `rentchain-api/.env.example`
- `rentchain-api/.env.example.pilot`
- `rentchain-api/src/config/requiredEnv.ts`
- `rentchain-api/src/config/firestoreEnvironmentGuard.ts`
- `rentchain-api/src/config/planMatrix.ts`
- `rentchain-api/src/config/__tests__/requiredEnv.test.ts`
- `rentchain-api/src/config/__tests__/firestoreEnvironmentGuard.test.ts`

## Validation Sources

Backend startup calls `assertRequiredEnv()` from `rentchain-api/src/config/requiredEnv.ts`.

Required variables are enforced as hard requirements in production. In non-production startup they emit warnings and startup continues. Recommended variables emit warnings when missing in all environments.

Firestore startup safety is enforced separately by `assertSafeFirestoreEnvironment()` in `rentchain-api/src/config/firestoreEnvironmentGuard.ts`. This mission does not change that guard.

## Required Variables

| Variable | Current template default | Local development requirement | Production requirement |
| --- | --- | --- | --- |
| `JWT_SECRET` | `local_dev_jwt_secret` | Fake local signing secret is acceptable for local-only use. | Must be a real secret-managed value. |
| `APP_BASE_URL` or `FRONTEND_URL` or `PUBLIC_APP_URL` | Localhost URLs | At least one local URL must be set; templates set all three for clarity. | Must be the deployed production application URL. |
| `STRIPE_SECRET_KEY` | `sk_test_local_placeholder` | Fake test-looking placeholder only; not usable for Stripe calls. | Must be a real secret-managed Stripe key. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_local_placeholder` | Fake local placeholder only. | Must be the real webhook secret for the deployed endpoint. |
| `INTERNAL_JOB_TOKEN` | `local_dev_internal_job_token` | Fake local token for local-only internal route testing. | Must be a real secret-managed token. |
| `FIREBASE_API_KEY` | `local_dev_firebase_api_key` | Fake local placeholder satisfies startup warning only. | Must be the real configured Firebase API key. |
| `STRIPE_PRICE_STARTER_MONTHLY_LIVE` | `price_local_starter` | Fake local price ID placeholder only. | Must be the real live Stripe price ID. |
| `STRIPE_PRICE_PRO_MONTHLY_LIVE` | `price_local_pro` | Fake local price ID placeholder only. | Must be the real live Stripe price ID. |
| `STRIPE_PRICE_ELITE_MONTHLY_LIVE` or `STRIPE_PRICE_BUSINESS_MONTHLY_LIVE` | `price_local_elite` and `price_local_business` | Fake local price ID placeholders only. | Must be the real live Stripe price ID for the active canonical plan key. |
| `SENDGRID_API_KEY` or Mailgun trio | `sg_local_placeholder` with `EMAIL_PROVIDER=sendgrid` | Fake SendGrid placeholder avoids local startup warnings. | Must be real provider credentials for the selected email provider. |
| `SENDGRID_FROM_EMAIL` or Mailgun trio | `dev@rentchain.local` | Fake local sender address. | Must be an approved production sender address. |

Mailgun production configuration requires `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `EMAIL_FROM` when `EMAIL_PROVIDER=mailgun`. The local templates default to SendGrid placeholders because the startup validator defaults to SendGrid when no provider is configured.

## Recommended Variables

| Variable | Current template default | Local development requirement | Production requirement |
| --- | --- | --- | --- |
| `EMAIL_REPLY_TO` | `dev@rentchain.local` | Fake local mailbox. | Must be an approved monitored mailbox. |
| `MAINTENANCE_NOTIFY_EMAIL` | `dev@rentchain.local` | Fake local mailbox. | Must be an approved monitored mailbox. |
| `VERIFIED_SCREENING_NOTIFY_EMAIL` | `dev@rentchain.local` | Fake local mailbox. | Must be an approved monitored mailbox. |
| `ADMIN_EMAILS` | `dev@rentchain.local` | Fake local administrator identity for local-only flows. | Must list authorized production administrators. |
| `AUTH_BOOTSTRAP_TOKEN` | `local_dev_bootstrap_token` | Fake local token only. | Must be a real secret-managed bootstrap token if enabled. |
| `AUTH_LOGIN_ENABLED` | `true` | Enables local login flows where supported. | Must match the approved production auth posture. |
| `PASSWORD_LOGIN_ENABLED` | `true` | Enables local password login where supported. | Must match the approved production auth posture. |

## Firestore Guard Requirements

| Variable | Current template default | Local development requirement | Production requirement |
| --- | --- | --- | --- |
| `FIRESTORE_EMULATOR_HOST` | `127.0.0.1:8080` | Required unless an explicit diagnostic override is approved. | Optional; production uses managed Firestore credentials. |
| `ALLOW_LOCAL_PROD_FIRESTORE` | `false` | Must remain `false` for normal local development. | Not used as a local bypass. |
| `GOOGLE_APPLICATION_CREDENTIALS` | empty | Must remain empty for normal local development. | May be configured only through approved production secret handling. |

The Firestore guard still fails local, development, and test startup if the emulator host is missing or if `GOOGLE_APPLICATION_CREDENTIALS` is set without the explicit local production Firestore override.

## Startup Warning Before And After

Before this template completion, the local templates did not cover the hard and soft startup variables, so local backend startup could warn for required and recommended variables.

Expected warning categories before completion:

- Missing required env vars from `assertRequiredEnv()`.
- Missing recommended env vars from `assertRequiredEnv()`.

After using the completed local API template values, `assertRequiredEnv()` emits no required or recommended startup warnings for the audited variables while preserving production failure behavior.

The templates also include fake test and yearly Stripe price IDs so local pricing health derives complete placeholder metadata when the fake `sk_test` key is present.

Observed local startup comparison:

| Scenario | Result |
| --- | --- |
| Baseline with only emulator guard values | Startup emitted missing required env warnings, missing recommended env warnings, and missing pricing env metadata warnings. |
| Completed `rentchain-api/.env.example` values | Startup emitted no missing required, recommended, or pricing env warnings. Backend reached `rentchain-api dev listening on 3100`. |

Port `3100` was used for the completed-template verification because local port `3000` was already occupied during validation.

## Production Safety Assessment

- No real credentials are present in templates.
- No live Stripe keys are present in templates.
- No production URLs are present in templates.
- No production email addresses are present in templates.
- No committed `.env` files are required.
- No production environment variables are modified by this change.
- Boot validation remains unchanged.
- Missing-env detection remains unchanged.
- Firestore emulator protections remain unchanged.
- Payments, screening, maintenance, reviews, tenant workflows, landlord workflows, and admin workflows are not modified.

## Test Evidence

- `cd rentchain-api && npm run build` passed under Node 20.20.2.
- `cd rentchain-api && npm test -- --runInBand src/config/__tests__/requiredEnv.test.ts src/config/__tests__/firestoreEnvironmentGuard.test.ts` passed under Node 20.20.2.
- `cd rentchain-api && npm test -- --runInBand src/config/__tests__/secretEnvGovernance.test.ts` passed under Node 20.20.2.
- `git diff --check` passed.
