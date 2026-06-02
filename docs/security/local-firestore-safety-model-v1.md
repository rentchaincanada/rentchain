# Local Firestore Safety Model v1

## Objective

RentChain local development, local tests, and utility processes must not access production Firestore by default. Production behavior remains unchanged.

## Local Development Workflow

Local backend development uses:

- Firestore emulator at `127.0.0.1:8080`
- Emulator UI at `127.0.0.1:4000`
- `ALLOW_LOCAL_PROD_FIRESTORE=false`
- no `GOOGLE_APPLICATION_CREDENTIALS`

If a local backend process imports Firebase Admin or creates a Firestore client without emulator configuration, startup fails before Firebase Admin initialization.

## QA Workflow

Local and automated backend test scripts set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. Tests must not depend on production Firestore. Existing mocked Firestore tests remain mocked; tests that import real Firestore-backed modules receive emulator configuration.

Browser smoke tests and frontend Playwright suites do not directly initialize backend Firebase Admin. When they depend on a local backend, that backend must be started with emulator configuration.

## Preview Workflow

Preview environments are not local development. They must use their approved deployment environment and explicit runtime configuration. This mission does not modify preview deployment configuration, Terraform, Firestore rules, Cloud Run settings, or credential provisioning.

If a preview process sets `NODE_ENV` to a non-production value, it must provide emulator configuration or use an explicitly reviewed environment model before backend startup.

## Production Workflow

Production startup is unchanged:

- `NODE_ENV=production` is exempt from local emulator requirements.
- Production credentials continue to use the existing deployment credential model.
- No production environment variables were modified.
- No Terraform, Cloud Run, or CI/CD deployment configuration was changed.

## Guard Model

The startup guard enforces three local rules:

1. Non-production startup requires `FIRESTORE_EMULATOR_HOST`.
2. Non-production startup rejects `GOOGLE_APPLICATION_CREDENTIALS` unless `ALLOW_LOCAL_PROD_FIRESTORE=true`.
3. Explicit override emits a warning and is treated as a diagnostic exception, not normal development.

The guard runs before:

- Firebase Admin app initialization in `rentchain-api/src/config/firebase.ts`
- Firebase Admin app initialization in legacy `rentchain-api/src/firebase.ts`
- Direct Firestore client creation in `auditEventsService`
- Direct Firestore client creation in `firestoreUnitsService`

## Production Protection Model

The safety model prevents accidental production Firestore access from:

- local backend server startup
- local test runners
- local utility scripts that import shared Firebase config
- migration and seed utilities using shared Firebase config
- direct Firestore client modules identified in the audit

The model does not grant new access. It only blocks unsafe local startup and documents the explicit override path.

## Emulator Rules

Root `firestore.rules` is local-development-only and allows emulator reads/writes. It is referenced by root `firebase.json` for emulator startup. It is not production Firestore authorization policy and must not be deployed to production without a separate production rules review.

The existing API-local Firestore rules remain unchanged.

## Remaining Risks

- Legacy `rentchain-api/src/firebase.ts` still exists and should be consolidated into the canonical config path in a future mission.
- Manually created Firestore indexes should be documented separately.
- Utility scripts that bypass the shared Firebase modules in the future must import the guard before Firestore client creation.
