# Firestore Initialization Audit v1

Date: 2026-06-02

Scope: Phase safety mission for local Firestore emulator defaults and production Firestore access guardrails.

## Summary

Firestore access in the backend is concentrated in two Firebase Admin initialization modules and many route/service consumers. The risk before this mission was that local or test startup could initialize Firebase Admin with Application Default Credentials or default project metadata when `FIRESTORE_EMULATOR_HOST` was missing. The required action is a deterministic guard that runs before Firebase Admin app initialization and before direct Firestore client creation.

## Initialization Inventory

| File path | Initialization method | Environment behavior before guard | Risk assessment | Recommended action |
| --- | --- | --- | --- | --- |
| `rentchain-api/src/config/firebase.ts` | `admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId })`, then `admin.firestore()` | Uses application default credentials and hard-coded project ID when imported | High local risk: local credentials could reach production Firestore if emulator host is absent | Guard before `initializeApp`; require emulator outside production; keep production path unchanged |
| `rentchain-api/src/firebase.ts` | `admin.initializeApp({ projectId })`, then `getFirestore()` | Uses default Firebase Admin credential discovery with project env fallback | High local risk: legacy import path could bypass the canonical config module | Guard before `initializeApp`; keep legacy path protected until retired |
| `rentchain-api/src/services/auditEventsService.ts` | Direct `getFirestore()` at module load | Creates Firestore client without importing shared config | Medium risk: can bypass shared config if imported early | Guard before direct `getFirestore()` |
| `rentchain-api/src/services/firestoreUnitsService.ts` | Direct `getFirestore()` at module load | Creates Firestore client without importing shared config | Medium risk: can bypass shared config if imported early | Guard before direct `getFirestore()` |
| `rentchain-api/src/events/firestore.ts` | Imports `../config/firebase`, then calls `admin.firestore()` | Relies on config module to initialize app | Covered when config module is guarded | No separate action required after config guard |
| `rentchain-api/src/app.build.ts` | Imports route modules at startup; route modules import `db` from config | Route imports can initialize Firebase Admin before `src/index.ts` body executes | High if guard only ran in `index.ts`; safe if guard runs inside config module | Guard in Firebase config module, not only server entrypoint |
| `rentchain-api/src/index.ts` | Imports app, then calls `assertRequiredEnv()` and `listen()` | App import can load Firestore before startup body | Not sufficient as sole guard location | Keep as server entrypoint; Firestore guard belongs in config modules |
| `rentchain-api/scripts/migrations/lib/leaseMigrationSupport.ts` | Imports `db` and `FieldValue` from config | Migration utilities initialize Firestore through config | High local risk if run with credentials and no emulator | Covered by config guard; document override process |
| `rentchain-api/scripts/migrations/hideListedTestTenants.ts` | Imports `db` and `FieldValue` from config | Migration utility initializes Firestore through config | High local risk if run with credentials and no emulator | Covered by config guard; document override process |
| `rentchain-api/src/scripts/seedTenantEvents.ts` | Imports `db` from config | Seed utility initializes Firestore through config | Medium local risk | Covered by config guard |
| `rentchain-api/src/scripts/seedHarbourView.ts` | Imports `db` from legacy `src/firebase.ts` | Seed utility uses legacy initialization path | High local risk if legacy path unguarded | Guard legacy `src/firebase.ts` |
| `rentchain-api/src/billing/subscriptionService.ts` and legacy consumers | Imports `db` from legacy `src/firebase.ts` | Runtime modules use legacy path | High local risk if legacy path unguarded | Guard legacy `src/firebase.ts`; future consolidation can retire legacy path |
| `rentchain-api/src/**` route/service consumers importing `../config/firebase` | Shared `db`, `firestore`, or `FieldValue` export | Indirectly initializes Firebase Admin through config | Covered by config guard | No per-consumer changes required |
| `rentchain-api/src/**` modules importing only Firebase Admin types | Type-only or static helper usage | Does not create Firestore client | Low | No guard needed unless client creation is added |
| `rentchain-frontend/src/lib/firebase.ts` | Firebase client SDK `initializeApp(firebaseConfig)` | Browser auth/client app initialization, not Admin Firestore | Low for server production Firestore access | Out of backend guard scope; no change |

## Environment Variable Inventory

| Name | Current references | Risk assessment | Recommended action |
| --- | --- | --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | API pilot env example, health routes, secret governance tests, docs | High local risk if present with no emulator | Guard blocks outside production unless explicit override is true |
| `FIRESTORE_EMULATOR_HOST` | Not previously configured as default local runtime env | Missing guardrail | Add env examples, scripts, runbook, and guard requirement |
| `GCLOUD_PROJECT` | Legacy Firebase initialization and admin bootstrap diagnostics | Project selection metadata | Production behavior unchanged; local safety enforced by guard |
| `GOOGLE_CLOUD_PROJECT` | Legacy Firebase initialization and admin bootstrap diagnostics | Project selection metadata | Production behavior unchanged; local safety enforced by guard |
| `FIREBASE_CONFIG` | Health route credential presence check | Could indicate Firebase runtime config | No direct change; guard focuses on Firestore emulator/credential access |
| `ALLOW_LOCAL_PROD_FIRESTORE` | New explicit override | Controlled break-glass path | Default false; warning emitted when true |

## Script and Tooling Inventory

| Surface | Firestore behavior | Risk assessment | Recommended action |
| --- | --- | --- | --- |
| `rentchain-api` `dev` | Starts API server and imports Firestore-backed routes | High without emulator | Default to emulator host |
| `rentchain-api` `test*` scripts | Vitest may import Firestore-backed modules | Medium without emulator | Default test scripts to emulator host |
| `rentchain-api` `test:e2e*` scripts | API Playwright checks may hit backend routes | Medium without emulator | Default to emulator host |
| `rentchain-api` migration scripts | Direct Firestore reads/writes through shared config | High if used casually | Guard blocks local credential use unless override is explicit |
| `rentchain-api` seed scripts | Direct Firestore writes through shared or legacy config | High if used casually | Guard blocks local credential use unless emulator or override is explicit |
| `tools/qa/run-*-smoke.sh` | Browser/API smoke wrappers; may call backend endpoints | Medium | Backend process must use emulator env; production QA remains separately gated by existing URL protections |
| `rentchain-frontend` Playwright tests | Browser-driven tests, mostly mocked storage state and route fixtures | Low direct Firestore risk | No backend guard bypass found |
| `rentchain-frontend` scripts | QA report generation only | Low | No action |

## Production Path Confirmation

Cloud Run production startup uses `NODE_ENV=production` and the compiled backend `start` script. The guard does not require `FIRESTORE_EMULATOR_HOST` in production and does not change the production credential model. No production environment variables, deployment files, Terraform files, or Cloud Run configuration were modified.

## Remaining Recommendations

- Retire the legacy `rentchain-api/src/firebase.ts` path in a separate consolidation mission.
- Document the manually created `transitionProvenanceEvents` composite index in a separate Firestore index documentation mission.
- Keep production Firestore rules separate from root local emulator rules; never deploy root `firestore.rules` to production without separate review.
