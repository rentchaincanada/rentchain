# Secret Rotation and Environment Governance v1

## Executive Summary

This report documents RentChain's current secret and environment-variable governance posture and adds lightweight regression protection for secret exposure. It does not rotate credentials, change environment values, change authentication behavior, or modify infrastructure.

Minimal runtime hardening in this mission is limited to diagnostics:

- Firebase API key prefixes are no longer logged during password sign-in.
- `GOOGLE_APPLICATION_CREDENTIALS` local path values are no longer printed at Firebase initialization.
- structured logging redaction now treats broader API key, private key, and service account key names as restricted.

No permissions, route visibility, JWT format, Firebase behavior, Firestore rules, provider behavior, or production env values changed.

## Environment and Secret Inventory

| Category | Examples | Expected location | Client exposure |
| --- | --- | --- | --- |
| Client-exposed frontend config | `VITE_API_BASE_URL`, `VITE_API_BASE`, `VITE_TELEMETRY_ENABLED`, `VITE_TENANT_PORTAL_ENABLED`, `VITE_SCREENING_ENABLED`, `VITE_BUREAU_PROVIDER`, `VITE_BUREAU_ADAPTER_SHADOW_MODE`, `VITE_BUREAU_ADAPTER_SHADOW_SAMPLE_RATE`, `VITE_BUREAU_ADAPTER_SHADOW_TIMEOUT_MS`, `VITE_MAINTENANCE_MODE`, `VITE_MAINTENANCE_ADMIN_BYPASS`, `VITE_BUILD_ID` | Vercel frontend env / CI for tests | Allowed; anything prefixed `VITE_` may be bundled into browser code. |
| Backend auth/session secrets | `JWT_SECRET`, `AUTH_BOOTSTRAP_TOKEN`, `INTERNAL_JOB_TOKEN` | Cloud Run backend env / GitHub secrets for jobs when needed | Server-only. Never reference from `rentchain-frontend/src`. |
| Firebase/Admin configuration | `FIREBASE_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` | Cloud Run backend env / ADC; frontend may only use explicitly public Firebase config if added later | `FIREBASE_API_KEY` is treated as backend-required in current auth flow; credential paths and service account material are server-only. |
| Stripe/payment secrets | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, live/test price IDs | Cloud Run backend env | Secret keys and webhook secrets are server-only. Price IDs are configuration identifiers, not credentials, but should still be environment-scoped. |
| Email provider secrets | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `EMAIL_FROM`, `FROM_EMAIL`, `EMAIL_REPLY_TO` | Cloud Run backend env / Vercel serverless waitlist env where applicable | API keys are server-only; sender addresses are operational config. |
| Screening/provider secrets | `SCREENING_ENCRYPTION_KEY`, `TRANSUNION_CREDENTIALS_ENCRYPTION_KEY`, `TU_REFERRAL_SIGNING_SECRET`, `BUREAU_PROVIDER`, `SCREENING_PROVIDER`, `TU_REFERRAL_BASE_URL`, `TU_REFERRAL_CALLBACK_URL`, `TU_REFERRAL_RETURN_URL` | Cloud Run backend env | Signing/encryption keys are server-only. Provider labels and URLs are operational config. |
| Storage/document secrets | `GCS_UPLOAD_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` | Cloud Run backend env / ADC | Bucket names are internal config; credential paths/material are server-only. |
| OpenAI/Codex automation | `OPENAI_API_KEY` | GitHub Actions secrets for Codex review/autofix/mission runner | Server/job-only; never bundled into frontend. |
| Operational feature flags | `AUTH_LOGIN_ENABLED`, `PASSWORD_LOGIN_ENABLED`, `AUTH_HYDRATE_FROM_DB`, `ALLOW_MOCK_PROVIDER_CHECKOUT`, `DEMO_PLAN`, `REPORTING_*`, jurisdiction gateway flags | Cloud Run backend env | Server-side unless intentionally mirrored as `VITE_*`. |
| Vercel/GitHub deployment metadata | `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_ENV`, `BASE_URL` for tests | Vercel/GitHub runtime | Non-secret metadata; safe to expose only where intentionally used. |

## Server-Only vs Client-Exposed Rules

Rules:

1. `VITE_*` variables are client-exposed by design and must never contain credentials or privileged tokens.
2. Server-only secrets must not appear in `rentchain-frontend/src`.
3. Frontend API access should use public base URLs, not backend secret material.
4. Backend routes must read secrets from process env at runtime and must not print values, prefixes, or credential paths.
5. Tests may use fake placeholder values only when clearly synthetic, such as `sk_test`, `whsec_test`, or `secret-token`.

Regression coverage now scans frontend client source for known server-only env names.

## Required and Recommended Env Posture

`rentchain-api/src/config/requiredEnv.ts` currently classifies hard boot requirements for production:

- `JWT_SECRET`
- one of `APP_BASE_URL`, `FRONTEND_URL`, `PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `INTERNAL_JOB_TOKEN`
- `FIREBASE_API_KEY`
- live Stripe price IDs
- provider-specific email requirements depending on `EMAIL_PROVIDER`

Recommended but non-fatal values include:

- `EMAIL_REPLY_TO`
- `MAINTENANCE_NOTIFY_EMAIL`
- `VERIFIED_SCREENING_NOTIFY_EMAIL`
- `ADMIN_EMAILS`
- `AUTH_BOOTSTRAP_TOKEN`
- `AUTH_LOGIN_ENABLED`
- `PASSWORD_LOGIN_ENABLED`

## Webhook and Internal Token Handling

Webhook secrets and internal job tokens are high-priority credentials:

- Stripe webhook verification must continue to use `STRIPE_WEBHOOK_SECRET`.
- TransUnion/referral signing must keep `TU_REFERRAL_SIGNING_SECRET` server-only.
- Internal routes using `INTERNAL_JOB_TOKEN` must not log token values or compare them in frontend code.
- Webhook retry behavior should not expose signature values in telemetry or logs.

## Preview, Staging, and Production Separation

Expected separation:

- Preview deployments should use preview-safe API base URLs and test/staging provider credentials.
- Production should use production Cloud Run env and production Vercel frontend env.
- Live Stripe keys and live webhook secrets must not be shared with preview unless explicitly approved.
- Provider signing/encryption keys should be environment-specific.
- GitHub Actions secrets should be limited to workflows that need them.

Known repo limitation:

- Terraform/Cloud Run secret bindings are not represented in a `terraform/` directory in this checkout, so this audit cannot verify live environment bindings from code alone.

## Rotation Priority Matrix

| Priority | Secret family | Rotation trigger | Notes |
| --- | --- | --- | --- |
| Critical | `JWT_SECRET`, `INTERNAL_JOB_TOKEN`, `AUTH_BOOTSTRAP_TOKEN` | suspected exposure, admin/support access incident, employee/vendor offboarding, auth incident | Rotate through controlled downtime/dual-token plan where needed. |
| Critical | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | payment incident, webhook signature exposure, Stripe dashboard access change | Coordinate webhook endpoint secret update and retry monitoring. |
| Critical | `TRANSUNION_CREDENTIALS_ENCRYPTION_KEY`, `SCREENING_ENCRYPTION_KEY`, `TU_REFERRAL_SIGNING_SECRET` | provider credential exposure, screening adapter incident, support/admin access issue | Requires provider workflow validation and encrypted payload compatibility review. |
| High | `MAILGUN_API_KEY`, `SENDGRID_API_KEY`, `OPENAI_API_KEY` | provider dashboard access change, suspicious outbound activity, GitHub secret exposure | Rotate provider-side first, then update runtime env/secrets. |
| High | `GOOGLE_APPLICATION_CREDENTIALS` / service account material | GCP service account exposure, bucket access incident | Prefer ADC/workload identity; avoid local key files in deployed environments. |
| Medium | Public base URLs, feature flags, price IDs | deployment misrouting, provider mode mistakes, pricing change | Not usually secret, but wrong values can cause production workflow risk. |
| Low | Build/deployment metadata | stale preview/prod diagnostics | Non-secret; validate for operational accuracy. |

## Emergency Rotation Checklist

1. Identify affected secret family and environment.
2. Disable or revoke the exposed credential at the provider when safe.
3. Create replacement credential in the provider console or secret manager.
4. Update Cloud Run/Vercel/GitHub secret binding without printing values.
5. Redeploy or restart affected runtime.
6. Validate login, dashboard, operations, webhook, payment, screening, and export flows as applicable.
7. Review structured logs for redaction and suspicious activity.
8. Record incident timeline and rotation metadata without storing secret values.
9. Schedule cleanup of obsolete provider credentials.

## Redaction and Exposure Controls

Structured logging redaction now suppresses common token and env key names, including:

- authorization headers and bearer tokens
- JWT/id/access/refresh/session/custom/internal job tokens
- webhook secrets
- API keys, including nested names such as `firebaseApiKey`
- private keys and service account JSON markers
- cookies and set-cookie headers
- provider payloads, raw CSV, stack traces, route-source/debug fields

This is not a repo-wide logging rewrite. Remaining ad-hoc logging should migrate to `safeLogger` over time.

## Risks Found

Resolved in this mission:

- `authService.signInWithPassword` logged the first 8 characters of `FIREBASE_API_KEY`.
- Firebase initialization logged the `GOOGLE_APPLICATION_CREDENTIALS` path value.
- Structured log key detection did not catch nested names such as `firebaseApiKey`.

Safe to defer:

- Some auth validation logs still include user email addresses for operational diagnostics.
- Backend code has broad `process.env` usage and no single env registry yet.
- Live Cloud Run/Vercel secret bindings cannot be verified from repo files alone.

## Future Hardening Missions

Recommended next steps:

1. Create a typed server env registry that classifies each env var as required, optional, server-only, provider, webhook, internal, or public config.
2. Add CI static checks for server-only env names in frontend bundles.
3. Migrate high-risk ad-hoc logs to `safeLogger`.
4. Create a controlled live credential rotation runbook with owner approvals.
5. Add provider-specific webhook secret rotation drills.
6. Add Cloud Run/Vercel/GitHub secret inventory validation outside the repo without printing values.

## Confirmation

This mission did not:

- rotate live credentials;
- add secret values to docs, tests, fixtures, or logs;
- change production env values;
- change Terraform or Cloud Run configuration;
- change auth behavior;
- change Firestore rules;
- change payment, screening, provider, tenant, evidence, or review behavior;
- broaden access or route visibility.
